use anchor_lang::prelude::*;

use crate::{
    constants::{EMPTY_PUBKEY, FACTORY_STATE_SEED},
    instructions::guards,
    state::FactoryState,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default)]
pub struct WalletUpdateArgs {
    pub new_dev_wallet: Option<Pubkey>,
    pub new_master_wallet: Option<Pubkey>,
    pub new_operator_wallet: Option<Pubkey>,
}

#[derive(Accounts)]
pub struct UpdateGlobalWallets<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [FACTORY_STATE_SEED], bump = factory_state.bump)]
    pub factory_state: Account<'info, FactoryState>,
}

pub fn update_global_wallets_handler(
    ctx: Context<UpdateGlobalWallets>,
    args: WalletUpdateArgs,
) -> Result<()> {
    let factory = &mut ctx.accounts.factory_state;
    guards::assert_owner(factory, &ctx.accounts.owner.key())?;

    if let Some(dev_wallet) = args.new_dev_wallet {
        require!(
            dev_wallet != EMPTY_PUBKEY,
            crate::errors::GamingStarsError::InvalidBeneficiary
        );
        factory.dev_wallet = dev_wallet;
    }
    if let Some(master_wallet) = args.new_master_wallet {
        require!(
            master_wallet != EMPTY_PUBKEY,
            crate::errors::GamingStarsError::InvalidBeneficiary
        );
        factory.master_wallet = master_wallet;
    }
    if let Some(operator_wallet) = args.new_operator_wallet {
        require!(
            operator_wallet != EMPTY_PUBKEY,
            crate::errors::GamingStarsError::InvalidBeneficiary
        );
        factory.operator_wallet = operator_wallet;
    }

    factory.updated_at = Clock::get()?.unix_timestamp;

    Ok(())
}
