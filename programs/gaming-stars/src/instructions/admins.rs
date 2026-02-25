use anchor_lang::prelude::*;

use crate::{
    constants::{FACTORY_STATE_SEED, MAX_ADMINS},
    errors::GamingStarsError,
    events::{AdminAdded, AdminRemoved},
    instructions::guards,
    state::FactoryState,
};

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [FACTORY_STATE_SEED], bump = factory_state.bump)]
    pub factory_state: Account<'info, FactoryState>,
}

pub fn add_admin_handler(ctx: Context<UpdateAdmin>, admin_wallet: Pubkey) -> Result<()> {
    let factory = &mut ctx.accounts.factory_state;
    guards::assert_owner(factory, &ctx.accounts.owner.key())?;

    require!(
        !factory.admins.iter().any(|admin| *admin == admin_wallet),
        GamingStarsError::AdminAlreadyExists
    );
    require!(
        factory.admins.len() < MAX_ADMINS,
        GamingStarsError::ImmutableConfig
    );

    factory.admins.push(admin_wallet);
    factory.updated_at = Clock::get()?.unix_timestamp;

    emit!(AdminAdded {
        admin: admin_wallet
    });
    Ok(())
}

pub fn remove_admin_handler(ctx: Context<UpdateAdmin>, admin_wallet: Pubkey) -> Result<()> {
    let factory = &mut ctx.accounts.factory_state;
    guards::assert_owner(factory, &ctx.accounts.owner.key())?;

    let len_before = factory.admins.len();
    factory.admins.retain(|admin| *admin != admin_wallet);

    require!(
        factory.admins.len() != len_before,
        GamingStarsError::AdminNotFound
    );

    factory.updated_at = Clock::get()?.unix_timestamp;
    emit!(AdminRemoved {
        admin: admin_wallet
    });
    Ok(())
}
