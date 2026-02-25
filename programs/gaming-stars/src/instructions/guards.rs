use anchor_lang::prelude::*;

use crate::{
    errors::GamingStarsError,
    state::{FactoryState, GameInstance, InstanceStatus},
};

pub fn assert_owner(factory: &FactoryState, authority: &Pubkey) -> Result<()> {
    require_keys_eq!(factory.owner, *authority, GamingStarsError::Unauthorized);
    Ok(())
}

pub fn assert_owner_or_admin(factory: &FactoryState, authority: &Pubkey) -> Result<()> {
    if factory.owner == *authority || factory.is_admin(authority) {
        return Ok(());
    }
    err!(GamingStarsError::Unauthorized)
}

pub fn assert_master_wallet(factory: &FactoryState, authority: &Pubkey) -> Result<()> {
    require_keys_eq!(
        factory.master_wallet,
        *authority,
        GamingStarsError::Unauthorized
    );
    Ok(())
}

pub fn assert_operator_wallet(factory: &FactoryState, authority: &Pubkey) -> Result<()> {
    require_keys_eq!(
        factory.operator_wallet,
        *authority,
        GamingStarsError::InvalidOperatorCosigner
    );
    Ok(())
}

pub fn assert_instance_not_paused(instance: &GameInstance) -> Result<()> {
    require!(
        instance.status != InstanceStatus::Paused,
        GamingStarsError::InstancePaused
    );
    Ok(())
}

pub fn assert_instance_active(instance: &GameInstance) -> Result<()> {
    require!(
        instance.status == InstanceStatus::Active,
        GamingStarsError::InstanceNotActive
    );
    Ok(())
}

pub fn assert_not_game_over(instance: &GameInstance) -> Result<()> {
    require!(
        instance.status != InstanceStatus::GameOver,
        GamingStarsError::GameOver
    );
    Ok(())
}

pub fn assert_accepted_mint(instance: &GameInstance, mint: &Pubkey) -> Result<()> {
    require!(
        instance
            .accepted_mints
            .iter()
            .any(|allowed| allowed == mint),
        GamingStarsError::InvalidMint
    );
    Ok(())
}

pub fn assert_supported_insurance_mint(instance: &GameInstance, mint: &Pubkey) -> Result<()> {
    require!(
        instance
            .insurance_mints
            .iter()
            .any(|allowed| allowed == mint),
        GamingStarsError::InvalidInsuranceMint
    );
    Ok(())
}
