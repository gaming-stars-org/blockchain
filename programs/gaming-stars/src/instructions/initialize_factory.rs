use anchor_lang::prelude::*;

use crate::{
    constants::{FACTORY_STATE_SEED, PROGRAM_VERSION},
    events::FactoryInitialized,
    state::FactoryState,
};

#[derive(Accounts)]
pub struct InitializeFactory<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = FactoryState::SPACE,
        seeds = [FACTORY_STATE_SEED],
        bump
    )]
    pub factory_state: Account<'info, FactoryState>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_factory_handler(
    ctx: Context<InitializeFactory>,
    dev_wallet: Pubkey,
    master_wallet: Pubkey,
    operator_wallet: Pubkey,
) -> Result<()> {
    let now_ts = Clock::get()?.unix_timestamp;
    let factory = &mut ctx.accounts.factory_state;

    factory.owner = ctx.accounts.owner.key();
    factory.admins = Vec::new();
    factory.dev_wallet = dev_wallet;
    factory.master_wallet = master_wallet;
    factory.operator_wallet = operator_wallet;
    factory.instance_count = 0;
    factory.program_version = PROGRAM_VERSION;
    factory.created_at = now_ts;
    factory.updated_at = now_ts;
    factory.bump = ctx.bumps.factory_state;

    emit!(FactoryInitialized {
        owner: factory.owner,
        dev_wallet,
        master_wallet,
        operator_wallet,
    });

    Ok(())
}
