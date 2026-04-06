use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke_signed, system_instruction},
    AccountsExit,
};
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{
    constants::{
        ACTIVE_ENTRY_SEED, INSTANCE_AUTHORITY_SEED, INSTANCE_SEED, LIQUIDITY_AUTHORITY_SEED,
        SETTLEMENT_RECEIPT_SEED, TICKET_RECORD_SEED,
    },
    errors::GamingStarsError,
    events::SettlementExecuted,
    instructions::{guards, vaults},
    state::{
        mark_ticket_forfeited, mark_ticket_paid, mark_ticket_refunded, ActiveEntry, FactoryState,
        GameInstance, ResolutionKind, SettlementKind, SettlementReceipt, TicketRecord,
    },
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TransferLeg {
    pub mint: Pubkey,
    pub amount: u64,
    pub source_vault: Pubkey,
    pub destination_ata: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SettlePayoutArgs {
    pub settlement_id: [u8; 32],
    pub instance_id: u64,
    pub ticket_id: u64,
    pub beneficiary: Pubkey,
    pub legs: Vec<TransferLeg>,
    pub resolution_kind: ResolutionKind,
    pub payload_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SettleRefundArgs {
    pub settlement_id: [u8; 32],
    pub instance_id: u64,
    pub ticket_id: u64,
    pub beneficiary: Pubkey,
    pub refund_mint: Pubkey,
    pub amount: u64,
    pub resolution_kind: ResolutionKind,
    pub payload_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SettleForfeitArgs {
    pub settlement_id: [u8; 32],
    pub instance_id: u64,
    pub ticket_id: u64,
    pub owner: Pubkey,
    pub legs: Vec<TransferLeg>,
    pub resolution_kind: ResolutionKind,
    pub payload_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct BatchSettleItem {
    pub settlement_id: [u8; 32],
    pub ticket_id: u64,
    pub owner: Pubkey,
    pub kind: SettlementKind,
    pub beneficiary: Option<Pubkey>,
    pub refund_mint: Option<Pubkey>,
    pub refund_amount: Option<u64>,
    pub legs: Vec<TransferLeg>,
    pub resolution_kind: ResolutionKind,
    pub payload_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SettleUsersBatchArgs {
    pub instance_id: u64,
    pub items: Vec<BatchSettleItem>,
}

#[derive(Accounts)]
#[instruction(args: SettlePayoutArgs)]
pub struct SettlePayout<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,
    #[account(seeds = [crate::constants::FACTORY_STATE_SEED], bump = factory_state.bump)]
    pub factory_state: Account<'info, FactoryState>,
    #[account(mut, seeds = [INSTANCE_SEED, &instance.instance_id.to_le_bytes()], bump = instance.bump)]
    pub instance: Account<'info, GameInstance>,
    #[account(mut, seeds = [TICKET_RECORD_SEED, instance.key().as_ref(), args.beneficiary.as_ref()], bump = ticket_record.bump, close = operator)]
    pub ticket_record: Account<'info, TicketRecord>,
    #[account(
        mut,
        seeds = [ACTIVE_ENTRY_SEED, instance.key().as_ref(), ticket_record.owner.as_ref()],
        bump = active_entry.bump,
        close = operator
    )]
    pub active_entry: Account<'info, ActiveEntry>,
    #[account(
        init,
        payer = operator,
        space = SettlementReceipt::SPACE,
        seeds = [SETTLEMENT_RECEIPT_SEED, &args.settlement_id],
        bump
    )]
    pub settlement_receipt: Account<'info, SettlementReceipt>,
    /// CHECK: validated against PDA derivation and used as signer for treasury vault transfers.
    pub instance_authority: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: SettleRefundArgs)]
pub struct SettleRefund<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,
    #[account(seeds = [crate::constants::FACTORY_STATE_SEED], bump = factory_state.bump)]
    pub factory_state: Account<'info, FactoryState>,
    #[account(mut, seeds = [INSTANCE_SEED, &instance.instance_id.to_le_bytes()], bump = instance.bump)]
    pub instance: Account<'info, GameInstance>,
    #[account(mut, seeds = [TICKET_RECORD_SEED, instance.key().as_ref(), args.beneficiary.as_ref()], bump = ticket_record.bump, close = operator)]
    pub ticket_record: Account<'info, TicketRecord>,
    #[account(
        mut,
        seeds = [ACTIVE_ENTRY_SEED, instance.key().as_ref(), ticket_record.owner.as_ref()],
        bump = active_entry.bump,
        close = operator
    )]
    pub active_entry: Account<'info, ActiveEntry>,
    #[account(
        init,
        payer = operator,
        space = SettlementReceipt::SPACE,
        seeds = [SETTLEMENT_RECEIPT_SEED, &args.settlement_id],
        bump
    )]
    pub settlement_receipt: Account<'info, SettlementReceipt>,
    pub refund_mint: InterfaceAccount<'info, anchor_spl::token_interface::Mint>,
    #[account(mut)]
    pub global_liquidity_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub beneficiary_token_account: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: validated against PDA derivation and used as signer for global liquidity transfers.
    pub liquidity_authority: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: SettleForfeitArgs)]
pub struct SettleForfeit<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,
    #[account(seeds = [crate::constants::FACTORY_STATE_SEED], bump = factory_state.bump)]
    pub factory_state: Account<'info, FactoryState>,
    #[account(mut, seeds = [INSTANCE_SEED, &instance.instance_id.to_le_bytes()], bump = instance.bump)]
    pub instance: Account<'info, GameInstance>,
    #[account(mut, seeds = [TICKET_RECORD_SEED, instance.key().as_ref(), args.owner.as_ref()], bump = ticket_record.bump, close = operator)]
    pub ticket_record: Account<'info, TicketRecord>,
    #[account(
        mut,
        seeds = [ACTIVE_ENTRY_SEED, instance.key().as_ref(), ticket_record.owner.as_ref()],
        bump = active_entry.bump,
        close = operator
    )]
    pub active_entry: Account<'info, ActiveEntry>,
    #[account(
        init,
        payer = operator,
        space = SettlementReceipt::SPACE,
        seeds = [SETTLEMENT_RECEIPT_SEED, &args.settlement_id],
        bump
    )]
    pub settlement_receipt: Account<'info, SettlementReceipt>,
    /// CHECK: validated against PDA derivation and used as signer for treasury vault transfers.
    pub instance_authority: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleUsersBatch<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,
    #[account(seeds = [crate::constants::FACTORY_STATE_SEED], bump = factory_state.bump)]
    pub factory_state: Account<'info, FactoryState>,
    #[account(mut, seeds = [INSTANCE_SEED, &instance.instance_id.to_le_bytes()], bump = instance.bump)]
    pub instance: Account<'info, GameInstance>,
    /// CHECK: validated against PDA derivation and used as signer for treasury vault transfers.
    pub instance_authority: UncheckedAccount<'info>,
    /// CHECK: validated against PDA derivation and used as signer for global liquidity transfers.
    pub liquidity_authority: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn settle_payout_handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, SettlePayout<'info>>,
    args: SettlePayoutArgs,
) -> Result<()> {
    let now_ts = Clock::get()?.unix_timestamp;

    guards::assert_operator_wallet(&ctx.accounts.factory_state, &ctx.accounts.operator.key())?;
    guards::assert_instance_not_paused(&ctx.accounts.instance)?;
    require!(
        ctx.accounts.instance.instance_id == args.instance_id,
        GamingStarsError::InvalidAmount
    );

    require_keys_eq!(
        ctx.accounts.ticket_record.owner,
        args.beneficiary,
        GamingStarsError::InvalidBeneficiary
    );
    require!(
        ctx.accounts.active_entry.instance_id == args.instance_id,
        GamingStarsError::InvalidAmount
    );
    require_keys_eq!(
        ctx.accounts.active_entry.owner,
        ctx.accounts.ticket_record.owner,
        GamingStarsError::VaultMismatch
    );

    execute_treasury_legs(
        ctx.program_id,
        &ctx.accounts.instance.key(),
        &ctx.accounts.instance_authority,
        &ctx.accounts.token_program,
        &args.legs,
        ctx.remaining_accounts,
        Some(args.beneficiary),
    )?;

    mark_ticket_paid(&mut ctx.accounts.ticket_record, now_ts, args.resolution_kind)?;
    write_receipt(
        &mut ctx.accounts.settlement_receipt,
        args.settlement_id,
        args.instance_id,
        args.ticket_id,
        SettlementKind::Payout,
        args.payload_hash,
        ctx.accounts.operator.key(),
        now_ts,
        ctx.bumps.settlement_receipt,
    );

    emit!(SettlementExecuted {
        settlement_id: args.settlement_id,
        instance_id: args.instance_id,
        ticket_id: args.ticket_id,
        kind: SettlementKind::Payout as u8,
    });

    Ok(())
}

pub fn settle_refund_handler(ctx: Context<SettleRefund>, args: SettleRefundArgs) -> Result<()> {
    let now_ts = Clock::get()?.unix_timestamp;

    guards::assert_operator_wallet(&ctx.accounts.factory_state, &ctx.accounts.operator.key())?;
    guards::assert_instance_not_paused(&ctx.accounts.instance)?;
    require!(
        ctx.accounts.instance.instance_id == args.instance_id,
        GamingStarsError::InvalidAmount
    );

    require_keys_eq!(
        ctx.accounts.ticket_record.owner,
        args.beneficiary,
        GamingStarsError::InvalidBeneficiary
    );
    require!(
        ctx.accounts.active_entry.instance_id == args.instance_id,
        GamingStarsError::InvalidAmount
    );
    require_keys_eq!(
        ctx.accounts.active_entry.owner,
        ctx.accounts.ticket_record.owner,
        GamingStarsError::VaultMismatch
    );

    execute_refund_transfer(
        ctx.program_id,
        &ctx.accounts.instance,
        &ctx.accounts.liquidity_authority,
        &ctx.accounts.token_program,
        args.beneficiary,
        args.refund_mint,
        args.amount,
        &ctx.accounts.refund_mint,
        &ctx.accounts.global_liquidity_vault,
        &ctx.accounts.beneficiary_token_account,
    )?;

    mark_ticket_refunded(&mut ctx.accounts.ticket_record, now_ts, args.resolution_kind)?;
    write_receipt(
        &mut ctx.accounts.settlement_receipt,
        args.settlement_id,
        args.instance_id,
        args.ticket_id,
        SettlementKind::Refund,
        args.payload_hash,
        ctx.accounts.operator.key(),
        now_ts,
        ctx.bumps.settlement_receipt,
    );

    emit!(SettlementExecuted {
        settlement_id: args.settlement_id,
        instance_id: args.instance_id,
        ticket_id: args.ticket_id,
        kind: SettlementKind::Refund as u8,
    });

    Ok(())
}

pub fn settle_forfeit_handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, SettleForfeit<'info>>,
    args: SettleForfeitArgs,
) -> Result<()> {
    let now_ts = Clock::get()?.unix_timestamp;

    guards::assert_operator_wallet(&ctx.accounts.factory_state, &ctx.accounts.operator.key())?;
    guards::assert_instance_not_paused(&ctx.accounts.instance)?;
    require!(
        ctx.accounts.instance.instance_id == args.instance_id,
        GamingStarsError::InvalidAmount
    );
    require!(
        ctx.accounts.active_entry.instance_id == args.instance_id,
        GamingStarsError::InvalidAmount
    );
    require_keys_eq!(
        ctx.accounts.active_entry.owner,
        ctx.accounts.ticket_record.owner,
        GamingStarsError::VaultMismatch
    );

    execute_treasury_legs(
        ctx.program_id,
        &ctx.accounts.instance.key(),
        &ctx.accounts.instance_authority,
        &ctx.accounts.token_program,
        &args.legs,
        ctx.remaining_accounts,
        None,
    )?;

    mark_ticket_forfeited(
        &mut ctx.accounts.ticket_record,
        now_ts,
        args.resolution_kind,
    )?;
    write_receipt(
        &mut ctx.accounts.settlement_receipt,
        args.settlement_id,
        args.instance_id,
        args.ticket_id,
        SettlementKind::Forfeit,
        args.payload_hash,
        ctx.accounts.operator.key(),
        now_ts,
        ctx.bumps.settlement_receipt,
    );

    emit!(SettlementExecuted {
        settlement_id: args.settlement_id,
        instance_id: args.instance_id,
        ticket_id: args.ticket_id,
        kind: SettlementKind::Forfeit as u8,
    });

    Ok(())
}

pub fn settle_users_batch_handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, SettleUsersBatch<'info>>,
    args: SettleUsersBatchArgs,
) -> Result<()> {
    let now_ts = Clock::get()?.unix_timestamp;

    guards::assert_operator_wallet(&ctx.accounts.factory_state, &ctx.accounts.operator.key())?;
    guards::assert_instance_not_paused(&ctx.accounts.instance)?;
    require!(
        ctx.accounts.instance.instance_id == args.instance_id,
        GamingStarsError::InvalidAmount
    );
    require!(!args.items.is_empty(), GamingStarsError::InvalidAmount);

    let mut seen_ids: Vec<[u8; 32]> = Vec::new();
    for item in &args.items {
        require!(
            !seen_ids.iter().any(|id| *id == item.settlement_id),
            GamingStarsError::DuplicateSettlement
        );
        seen_ids.push(item.settlement_id);
    }

    let instance_key = ctx.accounts.instance.key();
    let mut cursor: usize = 0;
    for item in &args.items {
        let ticket_ai = take_account(ctx.remaining_accounts, &mut cursor)?;
        let receipt_ai = take_account(ctx.remaining_accounts, &mut cursor)?;
        let active_entry_ai = take_account(ctx.remaining_accounts, &mut cursor)?;

        let (expected_ticket, _) =
            crate::state::derive_ticket_record(ctx.program_id, &instance_key, &item.owner);
        require_keys_eq!(expected_ticket, ticket_ai.key(), GamingStarsError::VaultMismatch);

        let mut ticket_record = Account::<TicketRecord>::try_from(ticket_ai)?;
        let active_entry = Account::<ActiveEntry>::try_from(active_entry_ai)?;
        let (expected_active_entry, _) =
            crate::state::derive_active_entry(ctx.program_id, &instance_key, &ticket_record.owner);
        require_keys_eq!(
            expected_active_entry,
            active_entry.key(),
            GamingStarsError::VaultMismatch
        );
        require!(
            active_entry.instance_id == args.instance_id,
            GamingStarsError::InvalidAmount
        );
        require_keys_eq!(
            active_entry.owner,
            ticket_record.owner,
            GamingStarsError::VaultMismatch
        );

        match item.kind {
            SettlementKind::Payout => {
                let beneficiary = item
                    .beneficiary
                    .ok_or(error!(GamingStarsError::InvalidBeneficiary))?;
                require_keys_eq!(
                    ticket_record.owner,
                    beneficiary,
                    GamingStarsError::InvalidBeneficiary
                );

                execute_treasury_legs_with_cursor(
                    ctx.program_id,
                    &instance_key,
                    &ctx.accounts.instance_authority,
                    &ctx.accounts.token_program,
                    &item.legs,
                    ctx.remaining_accounts,
                    &mut cursor,
                    Some(beneficiary),
                )?;

                mark_ticket_paid(&mut ticket_record, now_ts, item.resolution_kind)?;
                create_settlement_receipt(
                    ctx.program_id,
                    &ctx.accounts.operator,
                    &ctx.accounts.system_program,
                    receipt_ai,
                    item.settlement_id,
                    args.instance_id,
                    item.ticket_id,
                    SettlementKind::Payout,
                    item.payload_hash,
                    ctx.accounts.operator.key(),
                    now_ts,
                )?;

                emit!(SettlementExecuted {
                    settlement_id: item.settlement_id,
                    instance_id: args.instance_id,
                    ticket_id: item.ticket_id,
                    kind: SettlementKind::Payout as u8,
                });
            }
            SettlementKind::Refund => {
                let beneficiary = item
                    .beneficiary
                    .ok_or(error!(GamingStarsError::InvalidBeneficiary))?;
                let refund_mint = item
                    .refund_mint
                    .ok_or(error!(GamingStarsError::InvalidInsuranceMint))?;
                let refund_amount = item
                    .refund_amount
                    .ok_or(error!(GamingStarsError::InvalidAmount))?;

                require_keys_eq!(
                    ticket_record.owner,
                    beneficiary,
                    GamingStarsError::InvalidBeneficiary
                );
                let refund_mint_ai = take_account(ctx.remaining_accounts, &mut cursor)?;
                let global_vault_ai = take_account(ctx.remaining_accounts, &mut cursor)?;
                let beneficiary_ata_ai = take_account(ctx.remaining_accounts, &mut cursor)?;

                let refund_mint_account = InterfaceAccount::<Mint>::try_from(refund_mint_ai)?;
                let global_liquidity_vault =
                    InterfaceAccount::<TokenAccount>::try_from(global_vault_ai)?;
                let beneficiary_token_account =
                    InterfaceAccount::<TokenAccount>::try_from(beneficiary_ata_ai)?;

                execute_refund_transfer(
                    ctx.program_id,
                    &ctx.accounts.instance,
                    &ctx.accounts.liquidity_authority,
                    &ctx.accounts.token_program,
                    beneficiary,
                    refund_mint,
                    refund_amount,
                    &refund_mint_account,
                    &global_liquidity_vault,
                    &beneficiary_token_account,
                )?;

                mark_ticket_refunded(&mut ticket_record, now_ts, item.resolution_kind)?;
                create_settlement_receipt(
                    ctx.program_id,
                    &ctx.accounts.operator,
                    &ctx.accounts.system_program,
                    receipt_ai,
                    item.settlement_id,
                    args.instance_id,
                    item.ticket_id,
                    SettlementKind::Refund,
                    item.payload_hash,
                    ctx.accounts.operator.key(),
                    now_ts,
                )?;

                emit!(SettlementExecuted {
                    settlement_id: item.settlement_id,
                    instance_id: args.instance_id,
                    ticket_id: item.ticket_id,
                    kind: SettlementKind::Refund as u8,
                });
            }
            SettlementKind::Forfeit => {
                execute_treasury_legs_with_cursor(
                    ctx.program_id,
                    &instance_key,
                    &ctx.accounts.instance_authority,
                    &ctx.accounts.token_program,
                    &item.legs,
                    ctx.remaining_accounts,
                    &mut cursor,
                    None,
                )?;

                mark_ticket_forfeited(&mut ticket_record, now_ts, item.resolution_kind)?;
                create_settlement_receipt(
                    ctx.program_id,
                    &ctx.accounts.operator,
                    &ctx.accounts.system_program,
                    receipt_ai,
                    item.settlement_id,
                    args.instance_id,
                    item.ticket_id,
                    SettlementKind::Forfeit,
                    item.payload_hash,
                    ctx.accounts.operator.key(),
                    now_ts,
                )?;

                emit!(SettlementExecuted {
                    settlement_id: item.settlement_id,
                    instance_id: args.instance_id,
                    ticket_id: item.ticket_id,
                    kind: SettlementKind::Forfeit as u8,
                });
            }
        }

        ticket_record.close(ctx.accounts.operator.to_account_info())?;
        active_entry.close(ctx.accounts.operator.to_account_info())?;
    }

    require!(
        cursor == ctx.remaining_accounts.len(),
        GamingStarsError::InvalidAmount
    );

    Ok(())
}

fn execute_treasury_legs<'info>(
    program_id: &Pubkey,
    instance_key: &Pubkey,
    instance_authority: &UncheckedAccount<'info>,
    token_program: &Interface<'info, TokenInterface>,
    legs: &[TransferLeg],
    remaining_accounts: &'info [AccountInfo<'info>],
    beneficiary: Option<Pubkey>,
) -> Result<()> {
    let mut cursor = 0usize;
    execute_treasury_legs_with_cursor(
        program_id,
        instance_key,
        instance_authority,
        token_program,
        legs,
        remaining_accounts,
        &mut cursor,
        beneficiary,
    )?;
    require!(cursor == remaining_accounts.len(), GamingStarsError::InvalidAmount);
    Ok(())
}

fn execute_treasury_legs_with_cursor<'info>(
    program_id: &Pubkey,
    instance_key: &Pubkey,
    instance_authority: &UncheckedAccount<'info>,
    token_program: &Interface<'info, TokenInterface>,
    legs: &[TransferLeg],
    remaining_accounts: &'info [AccountInfo<'info>],
    cursor: &mut usize,
    beneficiary: Option<Pubkey>,
) -> Result<()> {
    require!(!legs.is_empty(), GamingStarsError::InvalidAmount);

    let (expected_instance_authority, instance_authority_bump) =
        crate::state::derive_instance_authority(program_id, instance_key);
    require_keys_eq!(
        expected_instance_authority,
        instance_authority.key(),
        GamingStarsError::VaultMismatch
    );

    let signer_seed_bump = [instance_authority_bump];
    let signer_seeds: &[&[u8]] = &[
        INSTANCE_AUTHORITY_SEED,
        instance_key.as_ref(),
        signer_seed_bump.as_ref(),
    ];

    for leg in legs {
        require!(leg.amount > 0, GamingStarsError::InvalidAmount);

        let transfer_mint_ai = take_account(remaining_accounts, cursor)?;
        let source_vault_ai = take_account(remaining_accounts, cursor)?;
        let destination_ata_ai = take_account(remaining_accounts, cursor)?;

        let transfer_mint = InterfaceAccount::<Mint>::try_from(transfer_mint_ai)?;
        let source_vault = InterfaceAccount::<TokenAccount>::try_from(source_vault_ai)?;
        let destination_ata = InterfaceAccount::<TokenAccount>::try_from(destination_ata_ai)?;

        require_keys_eq!(transfer_mint.key(), leg.mint, GamingStarsError::InvalidMint);
        require_keys_eq!(source_vault.key(), leg.source_vault, GamingStarsError::VaultMismatch);
        require_keys_eq!(
            destination_ata.key(),
            leg.destination_ata,
            GamingStarsError::VaultMismatch
        );
        require_keys_eq!(source_vault.mint, leg.mint, GamingStarsError::InvalidMint);
        require_keys_eq!(destination_ata.mint, leg.mint, GamingStarsError::InvalidMint);
        if let Some(expected_beneficiary) = beneficiary {
            require_keys_eq!(
                destination_ata.owner,
                expected_beneficiary,
                GamingStarsError::InvalidBeneficiary
            );
        }
        require!(
            source_vault.amount >= leg.amount,
            GamingStarsError::InsufficientVaultBalance
        );
        vaults::assert_treasury_vault(program_id, instance_key, &leg.mint, &source_vault.key())?;

        transfer_checked(
            CpiContext::new_with_signer(
                token_program.to_account_info(),
                TransferChecked {
                    mint: transfer_mint.to_account_info(),
                    from: source_vault.to_account_info(),
                    to: destination_ata.to_account_info(),
                    authority: instance_authority.to_account_info(),
                },
                &[signer_seeds],
            ),
            leg.amount,
            transfer_mint.decimals,
        )?;
    }

    Ok(())
}

fn execute_refund_transfer<'info>(
    program_id: &Pubkey,
    instance: &Account<'info, GameInstance>,
    liquidity_authority: &UncheckedAccount<'info>,
    token_program: &Interface<'info, TokenInterface>,
    beneficiary: Pubkey,
    refund_mint: Pubkey,
    amount: u64,
    refund_mint_account: &InterfaceAccount<'info, Mint>,
    global_liquidity_vault: &InterfaceAccount<'info, TokenAccount>,
    beneficiary_token_account: &InterfaceAccount<'info, TokenAccount>,
) -> Result<()> {
    require!(amount > 0, GamingStarsError::InvalidAmount);

    require_keys_eq!(
        refund_mint_account.key(),
        refund_mint,
        GamingStarsError::InvalidInsuranceMint
    );

    guards::assert_supported_insurance_mint(instance, &refund_mint)?;
    vaults::assert_global_liquidity_vault(program_id, &refund_mint, &global_liquidity_vault.key())?;

    require_keys_eq!(
        global_liquidity_vault.mint,
        refund_mint,
        GamingStarsError::InvalidInsuranceMint
    );
    require_keys_eq!(
        beneficiary_token_account.mint,
        refund_mint,
        GamingStarsError::InvalidInsuranceMint
    );
    require_keys_eq!(
        beneficiary_token_account.owner,
        beneficiary,
        GamingStarsError::InvalidBeneficiary
    );
    require!(
        global_liquidity_vault.amount >= amount,
        GamingStarsError::InsufficientVaultBalance
    );

    let (expected_liquidity_authority, liquidity_bump) =
        crate::state::derive_liquidity_authority(program_id);
    require_keys_eq!(
        expected_liquidity_authority,
        liquidity_authority.key(),
        GamingStarsError::VaultMismatch
    );

    let signer_seed_bump = [liquidity_bump];
    let signer_seeds: &[&[u8]] = &[LIQUIDITY_AUTHORITY_SEED, signer_seed_bump.as_ref()];

    transfer_checked(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            TransferChecked {
                mint: refund_mint_account.to_account_info(),
                from: global_liquidity_vault.to_account_info(),
                to: beneficiary_token_account.to_account_info(),
                authority: liquidity_authority.to_account_info(),
            },
            &[signer_seeds],
        ),
        amount,
        refund_mint_account.decimals,
    )?;

    Ok(())
}

fn create_settlement_receipt<'info>(
    program_id: &Pubkey,
    payer: &Signer<'info>,
    system_program: &Program<'info, System>,
    receipt_account: &'info AccountInfo<'info>,
    settlement_id: [u8; 32],
    instance_id: u64,
    ticket_id: u64,
    kind: SettlementKind,
    payload_hash: [u8; 32],
    executor: Pubkey,
    executed_at: i64,
) -> Result<()> {
    let (expected_receipt, bump) = crate::state::derive_settlement_receipt(program_id, &settlement_id);
    require_keys_eq!(
        expected_receipt,
        receipt_account.key(),
        GamingStarsError::VaultMismatch
    );

    require!(
        receipt_account.lamports() == 0,
        GamingStarsError::DuplicateSettlement
    );

    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(SettlementReceipt::SPACE);
    let create_ix = system_instruction::create_account(
        payer.key,
        receipt_account.key,
        lamports,
        SettlementReceipt::SPACE as u64,
        program_id,
    );

    let bump_seed = [bump];
    let signer_seeds: &[&[u8]] = &[SETTLEMENT_RECEIPT_SEED, &settlement_id, bump_seed.as_ref()];

    invoke_signed(
        &create_ix,
        &[
            payer.to_account_info(),
            receipt_account.to_account_info(),
            system_program.to_account_info(),
        ],
        &[signer_seeds],
    )?;

    let mut receipt = Account::<SettlementReceipt>::try_from_unchecked(receipt_account)?;
    write_receipt(
        &mut receipt,
        settlement_id,
        instance_id,
        ticket_id,
        kind,
        payload_hash,
        executor,
        executed_at,
        bump,
    );
    receipt.exit(program_id)?;

    Ok(())
}

fn take_account<'info>(
    accounts: &'info [AccountInfo<'info>],
    cursor: &mut usize,
) -> Result<&'info AccountInfo<'info>> {
    if *cursor >= accounts.len() {
        return err!(GamingStarsError::InvalidAmount);
    }
    let account = &accounts[*cursor];
    *cursor += 1;
    Ok(account)
}

fn write_receipt(
    receipt: &mut Account<SettlementReceipt>,
    settlement_id: [u8; 32],
    instance_id: u64,
    ticket_id: u64,
    kind: SettlementKind,
    payload_hash: [u8; 32],
    executor: Pubkey,
    executed_at: i64,
    bump: u8,
) {
    receipt.settlement_id = settlement_id;
    receipt.instance_id = instance_id;
    receipt.ticket_id = ticket_id;
    receipt.kind = kind;
    receipt.payload_hash = payload_hash;
    receipt.executor = executor;
    receipt.executed_at = executed_at;
    receipt.bump = bump;
}
