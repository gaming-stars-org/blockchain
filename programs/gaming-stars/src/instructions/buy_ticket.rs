use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{
    constants::{FACTORY_STATE_SEED, INSTANCE_SEED, TICKET_RECORD_SEED},
    errors::GamingStarsError,
    events::TicketPurchased,
    instructions::{guards, vaults},
    state::{EntryMode, FactoryState, GameInstance, TicketRecord, TicketStatus},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct BuyTicketArgs {
    pub entry_mode: EntryMode,
    pub entry_mint: Pubkey,
    pub insured: bool,
    pub entry_total_amount: u64,
    pub insurance_premium_amount: u64,
    pub external_ref: Option<[u8; 32]>,
}

#[derive(Accounts)]
pub struct BuyTicket<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub operator: Signer<'info>,
    pub payer_authority: Signer<'info>,
    #[account(seeds = [FACTORY_STATE_SEED], bump = factory_state.bump)]
    pub factory_state: Account<'info, FactoryState>,
    #[account(mut, seeds = [INSTANCE_SEED, &instance.instance_id.to_le_bytes()], bump = instance.bump)]
    pub instance: Account<'info, GameInstance>,
    #[account(
        init,
        payer = user,
        space = TicketRecord::SPACE,
        seeds = [TICKET_RECORD_SEED, instance.key().as_ref(), &instance.next_ticket_id.to_le_bytes()],
        bump
    )]
    pub ticket_record: Account<'info, TicketRecord>,
    pub entry_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub payer_entry_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub treasury_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub global_liquidity_vault: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: validated against PDA derivation and token owner checks.
    pub liquidity_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub dev_wallet_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn buy_ticket_handler(ctx: Context<BuyTicket>, args: BuyTicketArgs) -> Result<()> {
    guards::assert_operator_wallet(&ctx.accounts.factory_state, &ctx.accounts.operator.key())?;

    let instance = &mut ctx.accounts.instance;
    guards::assert_instance_active(instance)?;
    guards::assert_not_game_over(instance)?;
    guards::assert_accepted_mint(instance, &args.entry_mint)?;

    require_keys_eq!(
        ctx.accounts.entry_mint.key(),
        args.entry_mint,
        GamingStarsError::InvalidMint
    );
    require_keys_eq!(
        ctx.accounts.payer_entry_token_account.mint,
        args.entry_mint,
        GamingStarsError::InvalidMint
    );
    require_keys_eq!(
        ctx.accounts.treasury_vault.mint,
        args.entry_mint,
        GamingStarsError::InvalidMint
    );
    require_keys_eq!(
        ctx.accounts.global_liquidity_vault.mint,
        args.entry_mint,
        GamingStarsError::InvalidMint
    );
    require_keys_eq!(
        ctx.accounts.dev_wallet_token_account.mint,
        args.entry_mint,
        GamingStarsError::InvalidMint
    );

    match args.entry_mode {
        EntryMode::Paid => {
            require_keys_eq!(
                ctx.accounts.payer_authority.key(),
                ctx.accounts.user.key(),
                GamingStarsError::InvalidPayerAuthority
            );
        }
        EntryMode::Sponsored => {
            require_keys_eq!(
                ctx.accounts.payer_authority.key(),
                ctx.accounts.operator.key(),
                GamingStarsError::InvalidPayerAuthority
            );
        }
    }

    require_keys_eq!(
        ctx.accounts.payer_entry_token_account.owner,
        ctx.accounts.payer_authority.key(),
        GamingStarsError::InvalidPayerAuthority
    );

    if args.insured {
        require!(
            args.entry_mode != EntryMode::Sponsored,
            GamingStarsError::SponsoredInsuranceNotAllowed
        );
        require!(
            instance.insured_tickets_count < instance.max_insured_tickets,
            GamingStarsError::MaxInsuredTicketsReached
        );
        guards::assert_supported_insurance_mint(instance, &args.entry_mint)?;
        require!(
            args.insurance_premium_amount == instance.insurance_premium,
            GamingStarsError::InvalidAmount
        );
    } else {
        require!(
            args.insurance_premium_amount == 0,
            GamingStarsError::InvalidAmount
        );
    }

    let principal_plus_insurance = instance
        .ticket_price
        .checked_add(args.insurance_premium_amount)
        .ok_or(GamingStarsError::ArithmeticOverflow)?;
    let expected_total = principal_plus_insurance
        .checked_add(instance.entry_fee)
        .ok_or(GamingStarsError::ArithmeticOverflow)?;

    require!(
        args.entry_total_amount == expected_total,
        GamingStarsError::InvalidAmount
    );

    vaults::assert_treasury_vault(
        ctx.program_id,
        &instance.key(),
        &args.entry_mint,
        &ctx.accounts.treasury_vault.key(),
    )?;
    vaults::assert_global_liquidity_vault(
        ctx.program_id,
        &args.entry_mint,
        &ctx.accounts.global_liquidity_vault.key(),
    )?;
    let (expected_liquidity_authority, _) =
        crate::state::derive_liquidity_authority(ctx.program_id);
    require_keys_eq!(
        expected_liquidity_authority,
        ctx.accounts.liquidity_authority.key(),
        GamingStarsError::VaultMismatch
    );
    require_keys_eq!(
        ctx.accounts.global_liquidity_vault.owner,
        ctx.accounts.liquidity_authority.key(),
        GamingStarsError::VaultMismatch
    );
    require_keys_eq!(
        ctx.accounts.dev_wallet_token_account.owner,
        ctx.accounts.factory_state.dev_wallet,
        GamingStarsError::VaultMismatch
    );

    let decimals = ctx.accounts.entry_mint.decimals;

    let transfer_to_treasury = TransferChecked {
        mint: ctx.accounts.entry_mint.to_account_info(),
        from: ctx.accounts.payer_entry_token_account.to_account_info(),
        to: ctx.accounts.treasury_vault.to_account_info(),
        authority: ctx.accounts.payer_authority.to_account_info(),
    };
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_to_treasury,
        ),
        instance.ticket_price,
        decimals,
    )?;

    if args.insured {
        let transfer_to_glv = TransferChecked {
            mint: ctx.accounts.entry_mint.to_account_info(),
            from: ctx.accounts.payer_entry_token_account.to_account_info(),
            to: ctx.accounts.global_liquidity_vault.to_account_info(),
            authority: ctx.accounts.payer_authority.to_account_info(),
        };
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                transfer_to_glv,
            ),
            args.insurance_premium_amount,
            decimals,
        )?;
    }

    let transfer_to_dev = TransferChecked {
        mint: ctx.accounts.entry_mint.to_account_info(),
        from: ctx.accounts.payer_entry_token_account.to_account_info(),
        to: ctx.accounts.dev_wallet_token_account.to_account_info(),
        authority: ctx.accounts.payer_authority.to_account_info(),
    };
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_to_dev,
        ),
        instance.entry_fee,
        decimals,
    )?;

    if args.insured {
        instance.insured_tickets_count = instance
            .insured_tickets_count
            .checked_add(1)
            .ok_or(GamingStarsError::ArithmeticOverflow)?;
    }

    let now_ts = Clock::get()?.unix_timestamp;
    let ticket_id = instance.next_ticket_id;

    let ticket = &mut ctx.accounts.ticket_record;
    ticket.instance_id = instance.instance_id;
    ticket.ticket_id = ticket_id;
    ticket.owner = ctx.accounts.user.key();
    ticket.entry_mint = args.entry_mint;
    ticket.entry_mode = args.entry_mode;
    ticket.paid_by = ctx.accounts.payer_authority.key();
    ticket.principal_amount = instance.ticket_price;
    ticket.insured = args.insured;
    ticket.created_at = now_ts;
    ticket.status = TicketStatus::Active;
    ticket.resolved_at = None;
    ticket.resolution_kind = None;
    ticket.external_ref = args.external_ref;
    ticket.bump = ctx.bumps.ticket_record;

    instance.next_ticket_id = instance
        .next_ticket_id
        .checked_add(1)
        .ok_or(GamingStarsError::ArithmeticOverflow)?;
    instance.last_activity_ts = now_ts;
    instance.updated_at = now_ts;

    emit!(TicketPurchased {
        instance_id: ticket.instance_id,
        ticket_id,
        owner: ticket.owner,
        insured: ticket.insured,
    });

    Ok(())
}
