use anchor_lang::prelude::*;

use crate::{errors::GamingStarsError, state};

pub fn assert_treasury_vault(
    program_id: &Pubkey,
    instance: &Pubkey,
    mint: &Pubkey,
    vault: &Pubkey,
) -> Result<()> {
    let (expected, _) = state::derive_treasury_vault(program_id, instance, mint);
    require_keys_eq!(expected, *vault, GamingStarsError::VaultMismatch);
    Ok(())
}

pub fn assert_global_liquidity_vault(
    program_id: &Pubkey,
    mint: &Pubkey,
    vault: &Pubkey,
) -> Result<()> {
    let (expected, _) = state::derive_global_liquidity_vault(program_id, mint);
    require_keys_eq!(expected, *vault, GamingStarsError::VaultMismatch);
    Ok(())
}
