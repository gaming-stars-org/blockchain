use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{
    constants::{FACTORY_STATE_SEED, GLOBAL_LIQUIDITY_VAULT_SEED},
    errors::GamingStarsError,
    instructions::{guards, vaults},
    state::FactoryState,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TopupGlobalLiquidityArgs {
    pub mint: Pubkey,
    pub amount: u64,
}

#[derive(Accounts)]
pub struct TopupGlobalLiquidity<'info> {
    #[account(mut)]
    pub master_wallet: Signer<'info>,
    #[account(seeds = [FACTORY_STATE_SEED], bump = factory_state.bump)]
    pub factory_state: Account<'info, FactoryState>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub master_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, seeds = [GLOBAL_LIQUIDITY_VAULT_SEED, mint.key().as_ref()], bump)]
    pub global_liquidity_vault: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: only used as an owner identity for global vault checks.
    pub liquidity_authority: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn topup_global_liquidity_handler(
    ctx: Context<TopupGlobalLiquidity>,
    args: TopupGlobalLiquidityArgs,
) -> Result<()> {
    guards::assert_master_wallet(
        &ctx.accounts.factory_state,
        &ctx.accounts.master_wallet.key(),
    )?;

    require!(args.amount > 0, GamingStarsError::InvalidAmount);
    require_keys_eq!(
        ctx.accounts.mint.key(),
        args.mint,
        GamingStarsError::InvalidMint
    );
    require_keys_eq!(
        ctx.accounts.master_token_account.mint,
        args.mint,
        GamingStarsError::InvalidMint
    );
    require_keys_eq!(
        ctx.accounts.global_liquidity_vault.mint,
        args.mint,
        GamingStarsError::InvalidMint
    );
    require_keys_eq!(
        ctx.accounts.master_token_account.owner,
        ctx.accounts.master_wallet.key(),
        GamingStarsError::InvalidPayerAuthority
    );

    vaults::assert_global_liquidity_vault(
        ctx.program_id,
        &args.mint,
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

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.master_token_account.to_account_info(),
                to: ctx.accounts.global_liquidity_vault.to_account_info(),
                authority: ctx.accounts.master_wallet.to_account_info(),
            },
        ),
        args.amount,
        ctx.accounts.mint.decimals,
    )?;

    Ok(())
}
