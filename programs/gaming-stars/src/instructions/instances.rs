use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke_signed, system_instruction};
use anchor_lang::system_program;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_spl::token::spl_token::state::Account as SplTokenAccount;
use anchor_spl::token_interface::{
    initialize_account3, InitializeAccount3, TokenAccount as InterfaceTokenAccount, TokenInterface,
};

use crate::{
    constants::{
        FACTORY_STATE_SEED, GLOBAL_LIQUIDITY_VAULT_SEED, INSTANCE_SEED, MAX_ACCEPTED_MINTS,
        MAX_INSURANCE_MINTS, TREASURY_VAULT_SEED,
    },
    errors::GamingStarsError,
    events::{InstanceDeployed, InstanceStatusChanged},
    instructions::guards,
    state::{
        transition_to_active, transition_to_game_over, transition_to_paused, FactoryState,
        GameInstance, InstanceStatus,
    },
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct DeployInstanceArgs {
    pub instance_id: u64,
    pub ticket_price: u64,
    pub entry_fee: u64,
    pub insurance_premium: u64,
    pub max_insured_tickets: u32,
    pub payout_ratio_num: u16,
    pub payout_ratio_den: u16,
    pub game_duration_secs: i64,
    pub user_ttl_secs: i64,
    pub accepted_mints: Vec<Pubkey>,
    pub insurance_mints: Vec<Pubkey>,
}

#[derive(Accounts)]
#[instruction(args: DeployInstanceArgs)]
pub struct DeployInstance<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [FACTORY_STATE_SEED], bump = factory_state.bump)]
    pub factory_state: Account<'info, FactoryState>,
    #[account(
        init,
        payer = authority,
        space = GameInstance::SPACE,
        seeds = [INSTANCE_SEED, &args.instance_id.to_le_bytes()],
        bump
    )]
    pub instance: Account<'info, GameInstance>,
    /// CHECK: validated against PDA derivation.
    pub instance_authority: UncheckedAccount<'info>,
    /// CHECK: validated against PDA derivation.
    pub liquidity_authority: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn deploy_handler<'info>(
    ctx: Context<'_, '_, '_, 'info, DeployInstance<'info>>,
    args: DeployInstanceArgs,
) -> Result<()> {
    guards::assert_owner_or_admin(&ctx.accounts.factory_state, &ctx.accounts.authority.key())?;

    require!(args.payout_ratio_den > 0, GamingStarsError::InvalidAmount);
    require!(
        args.accepted_mints.len() <= MAX_ACCEPTED_MINTS && !args.accepted_mints.is_empty(),
        GamingStarsError::InvalidMint
    );
    require!(
        args.insurance_mints.len() <= MAX_INSURANCE_MINTS && !args.insurance_mints.is_empty(),
        GamingStarsError::InvalidInsuranceMint
    );
    require!(
        args.insurance_mints
            .iter()
            .all(|mint| args.accepted_mints.iter().any(|accepted| accepted == mint)),
        GamingStarsError::InvalidInsuranceMint
    );
    require!(
        ctx.remaining_accounts.len() == args.accepted_mints.len() * 3,
        GamingStarsError::InvalidMint
    );

    let now_ts = Clock::get()?.unix_timestamp;
    let factory = &mut ctx.accounts.factory_state;
    let instance = &mut ctx.accounts.instance;
    let instance_key = instance.key();

    let (expected_instance_authority, _) =
        crate::state::derive_instance_authority(ctx.program_id, &instance_key);
    require_keys_eq!(
        expected_instance_authority,
        ctx.accounts.instance_authority.key(),
        GamingStarsError::VaultMismatch
    );
    let (expected_liquidity_authority, _) = crate::state::derive_liquidity_authority(ctx.program_id);
    require_keys_eq!(
        expected_liquidity_authority,
        ctx.accounts.liquidity_authority.key(),
        GamingStarsError::VaultMismatch
    );

    instance.instance_id = args.instance_id;
    instance.status = InstanceStatus::Active;
    instance.ticket_price = args.ticket_price;
    instance.entry_fee = args.entry_fee;
    instance.insurance_premium = args.insurance_premium;
    instance.max_insured_tickets = args.max_insured_tickets;
    instance.insured_tickets_count = 0;
    instance.payout_ratio_num = args.payout_ratio_num;
    instance.payout_ratio_den = args.payout_ratio_den;
    let accepted_mints = args.accepted_mints.clone();
    instance.accepted_mints = accepted_mints.clone();
    instance.insurance_mints = args.insurance_mints;
    instance.last_activity_ts = now_ts;
    instance.game_duration_secs = args.game_duration_secs;
    instance.user_ttl_secs = args.user_ttl_secs;
    instance.pause_started_at = None;
    instance.cumulative_paused_secs = 0;
    instance.next_ticket_id = 0;
    instance.created_at = now_ts;
    instance.updated_at = now_ts;
    instance.bump = ctx.bumps.instance;

    for (idx, mint_key) in accepted_mints.iter().enumerate() {
        let offset = idx * 3;
        let mint_info = ctx.remaining_accounts[offset].clone();
        let treasury_vault = ctx.remaining_accounts[offset + 1].clone();
        let global_liquidity_vault = ctx.remaining_accounts[offset + 2].clone();

        require_keys_eq!(*mint_info.key, *mint_key, GamingStarsError::InvalidMint);
        require_keys_eq!(
            *mint_info.owner,
            ctx.accounts.token_program.key(),
            GamingStarsError::InvalidMint
        );

        let (expected_treasury, treasury_bump) =
            crate::state::derive_treasury_vault(ctx.program_id, &instance_key, mint_key);
        require_keys_eq!(
            expected_treasury,
            *treasury_vault.key,
            GamingStarsError::VaultMismatch
        );
        let (expected_global, global_bump) =
            crate::state::derive_global_liquidity_vault(ctx.program_id, mint_key);
        require_keys_eq!(
            expected_global,
            *global_liquidity_vault.key,
            GamingStarsError::VaultMismatch
        );

        let account_len = SplTokenAccount::LEN as u64;
        let lamports = Rent::get()?.minimum_balance(account_len as usize);
        let payer = ctx.accounts.authority.to_account_info();
        let system_program = ctx.accounts.system_program.to_account_info();
        let token_program = ctx.accounts.token_program.to_account_info();

        let create_treasury = system_instruction::create_account(
            payer.key,
            treasury_vault.key,
            lamports,
            account_len,
            token_program.key,
        );
        invoke_signed(
            &create_treasury,
            &[payer.clone(), treasury_vault.clone(), system_program.clone()],
            &[&[
                TREASURY_VAULT_SEED,
                instance_key.as_ref(),
                mint_key.as_ref(),
                &[treasury_bump],
            ]],
        )?;
        initialize_account3(CpiContext::new(
            token_program.clone(),
            InitializeAccount3 {
                account: treasury_vault.clone(),
                mint: mint_info.clone(),
                authority: ctx.accounts.instance_authority.to_account_info(),
            },
        ))?;

        if global_liquidity_vault.owner == &system_program::ID {
            let create_global = system_instruction::create_account(
                payer.key,
                global_liquidity_vault.key,
                lamports,
                account_len,
                token_program.key,
            );
            invoke_signed(
                &create_global,
                &[
                    payer.clone(),
                    global_liquidity_vault.clone(),
                    system_program.clone(),
                ],
                &[&[GLOBAL_LIQUIDITY_VAULT_SEED, mint_key.as_ref(), &[global_bump]]],
            )?;
            initialize_account3(CpiContext::new(
                token_program.clone(),
                InitializeAccount3 {
                    account: global_liquidity_vault.clone(),
                    mint: mint_info.clone(),
                    authority: ctx.accounts.liquidity_authority.to_account_info(),
                },
            ))?;
        } else {
            require_keys_eq!(
                *global_liquidity_vault.owner,
                token_program.key(),
                GamingStarsError::VaultMismatch
            );
            let data = global_liquidity_vault.try_borrow_data()?;
            let mut data_slice: &[u8] = &data;
            let global_token = InterfaceTokenAccount::try_deserialize(&mut data_slice)
                .map_err(|_| GamingStarsError::VaultMismatch)?;
            require_keys_eq!(
                global_token.mint,
                *mint_key,
                GamingStarsError::InvalidMint
            );
            require_keys_eq!(
                global_token.owner,
                ctx.accounts.liquidity_authority.key(),
                GamingStarsError::VaultMismatch
            );
        }
    }

    factory.instance_count = factory
        .instance_count
        .checked_add(1)
        .ok_or(GamingStarsError::ArithmeticOverflow)?;
    factory.updated_at = now_ts;

    emit!(InstanceDeployed {
        instance_id: instance.instance_id,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateInstanceStatus<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [FACTORY_STATE_SEED], bump = factory_state.bump)]
    pub factory_state: Account<'info, FactoryState>,
    #[account(mut, seeds = [INSTANCE_SEED, &instance.instance_id.to_le_bytes()], bump = instance.bump)]
    pub instance: Account<'info, GameInstance>,
}

pub fn freeze_handler(ctx: Context<UpdateInstanceStatus>) -> Result<()> {
    guards::assert_owner_or_admin(&ctx.accounts.factory_state, &ctx.accounts.authority.key())?;
    let now_ts = Clock::get()?.unix_timestamp;
    transition_to_paused(&mut ctx.accounts.instance, now_ts)?;

    emit!(InstanceStatusChanged {
        instance_id: ctx.accounts.instance.instance_id,
        status: ctx.accounts.instance.status as u8,
    });

    Ok(())
}

pub fn unfreeze_handler(ctx: Context<UpdateInstanceStatus>) -> Result<()> {
    guards::assert_owner_or_admin(&ctx.accounts.factory_state, &ctx.accounts.authority.key())?;
    let now_ts = Clock::get()?.unix_timestamp;
    transition_to_active(&mut ctx.accounts.instance, now_ts)?;

    emit!(InstanceStatusChanged {
        instance_id: ctx.accounts.instance.instance_id,
        status: ctx.accounts.instance.status as u8,
    });

    Ok(())
}

pub fn set_game_over_handler(ctx: Context<UpdateInstanceStatus>) -> Result<()> {
    guards::assert_operator_wallet(&ctx.accounts.factory_state, &ctx.accounts.authority.key())?;
    let now_ts = Clock::get()?.unix_timestamp;
    transition_to_game_over(&mut ctx.accounts.instance, now_ts)?;

    emit!(InstanceStatusChanged {
        instance_id: ctx.accounts.instance.instance_id,
        status: ctx.accounts.instance.status as u8,
    });

    Ok(())
}
