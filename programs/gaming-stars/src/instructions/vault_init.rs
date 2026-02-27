use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{
    constants::{
        FACTORY_STATE_SEED, GLOBAL_LIQUIDITY_VAULT_SEED, INSTANCE_AUTHORITY_SEED, INSTANCE_SEED,
        TREASURY_VAULT_SEED,
    },
    errors::GamingStarsError,
    instructions::guards,
    state::{FactoryState, GameInstance},
};

#[derive(Accounts)]
pub struct InitGlobalLiquidityVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [FACTORY_STATE_SEED], bump = factory_state.bump)]
    pub factory_state: Account<'info, FactoryState>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = authority,
        seeds = [GLOBAL_LIQUIDITY_VAULT_SEED, mint.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = liquidity_authority,
        token::token_program = token_program
    )]
    pub global_liquidity_vault: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: checked against PDA derivation and used as token owner only.
    #[account(seeds = [crate::constants::LIQUIDITY_AUTHORITY_SEED], bump)]
    pub liquidity_authority: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitTreasuryVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [FACTORY_STATE_SEED], bump = factory_state.bump)]
    pub factory_state: Account<'info, FactoryState>,
    #[account(seeds = [INSTANCE_SEED, &instance.instance_id.to_le_bytes()], bump = instance.bump)]
    pub instance: Account<'info, GameInstance>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = authority,
        seeds = [TREASURY_VAULT_SEED, instance.key().as_ref(), mint.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = instance_authority,
        token::token_program = token_program
    )]
    pub treasury_vault: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: checked against PDA derivation and used as token owner only.
    #[account(seeds = [INSTANCE_AUTHORITY_SEED, instance.key().as_ref()], bump)]
    pub instance_authority: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn init_global_liquidity_vault_handler(ctx: Context<InitGlobalLiquidityVault>) -> Result<()> {
    guards::assert_owner_or_admin(&ctx.accounts.factory_state, &ctx.accounts.authority.key())?;

    let (expected_liquidity_authority, _) = crate::state::derive_liquidity_authority(ctx.program_id);
    require_keys_eq!(
        expected_liquidity_authority,
        ctx.accounts.liquidity_authority.key(),
        GamingStarsError::VaultMismatch
    );

    Ok(())
}

pub fn init_treasury_vault_handler(ctx: Context<InitTreasuryVault>) -> Result<()> {
    guards::assert_owner_or_admin(&ctx.accounts.factory_state, &ctx.accounts.authority.key())?;

    let mint_key = ctx.accounts.mint.key();
    require!(
        ctx.accounts
            .instance
            .accepted_mints
            .iter()
            .any(|mint| *mint == mint_key),
        GamingStarsError::InvalidMint
    );

    let (expected_instance_authority, _) =
        crate::state::derive_instance_authority(ctx.program_id, &ctx.accounts.instance.key());
    require_keys_eq!(
        expected_instance_authority,
        ctx.accounts.instance_authority.key(),
        GamingStarsError::VaultMismatch
    );

    Ok(())
}
