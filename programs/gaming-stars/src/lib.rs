pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("5X2xYZ1oAebuc8NNMHa3LNgATow8QoFPuFraji93psJp");

#[program]
pub mod gaming_stars {
    use super::*;

    pub fn initialize_factory(
        ctx: Context<InitializeFactory>,
        dev_wallet: Pubkey,
        master_wallet: Pubkey,
        operator_wallet: Pubkey,
    ) -> Result<()> {
        initialize_factory::initialize_factory_handler(
            ctx,
            dev_wallet,
            master_wallet,
            operator_wallet,
        )
    }

    pub fn add_admin(ctx: Context<UpdateAdmin>, admin_wallet: Pubkey) -> Result<()> {
        add_admin_handler(ctx, admin_wallet)
    }

    pub fn remove_admin(ctx: Context<UpdateAdmin>, admin_wallet: Pubkey) -> Result<()> {
        remove_admin_handler(ctx, admin_wallet)
    }

    pub fn update_global_wallets(
        ctx: Context<UpdateGlobalWallets>,
        args: WalletUpdateArgs,
    ) -> Result<()> {
        wallets::update_global_wallets_handler(ctx, args)
    }

    pub fn deploy_instance<'info>(
        ctx: Context<'_, '_, '_, 'info, DeployInstance<'info>>,
        args: DeployInstanceArgs,
    ) -> Result<()> {
        deploy_handler(ctx, args)
    }

    pub fn freeze_instance(ctx: Context<UpdateInstanceStatus>) -> Result<()> {
        freeze_handler(ctx)
    }

    pub fn unfreeze_instance(ctx: Context<UpdateInstanceStatus>) -> Result<()> {
        unfreeze_handler(ctx)
    }

    pub fn buy_ticket(ctx: Context<BuyTicket>, args: BuyTicketArgs) -> Result<()> {
        buy_ticket_handler(ctx, args)
    }

    pub fn topup_global_liquidity(
        ctx: Context<TopupGlobalLiquidity>,
        args: TopupGlobalLiquidityArgs,
    ) -> Result<()> {
        topup_global_liquidity_handler(ctx, args)
    }

    pub fn init_global_liquidity_vault(ctx: Context<InitGlobalLiquidityVault>) -> Result<()> {
        init_global_liquidity_vault_handler(ctx)
    }

    pub fn init_treasury_vault(ctx: Context<InitTreasuryVault>) -> Result<()> {
        init_treasury_vault_handler(ctx)
    }

    pub fn settle_payout<'info>(
        ctx: Context<'_, '_, 'info, 'info, SettlePayout<'info>>,
        args: SettlePayoutArgs,
    ) -> Result<()> {
        settle_payout_handler(ctx, args)
    }

    pub fn settle_refund(ctx: Context<SettleRefund>, args: SettleRefundArgs) -> Result<()> {
        settle_refund_handler(ctx, args)
    }

    pub fn settle_forfeit<'info>(
        ctx: Context<'_, '_, 'info, 'info, SettleForfeit<'info>>,
        args: SettleForfeitArgs,
    ) -> Result<()> {
        settle_forfeit_handler(ctx, args)
    }

    pub fn settle_insured_expiry<'info>(
        ctx: Context<'_, '_, 'info, 'info, SettleInsuredExpiry<'info>>,
        args: SettleInsuredExpiryArgs,
    ) -> Result<()> {
        settle_insured_expiry_handler(ctx, args)
    }

    pub fn settle_users_batch<'info>(
        ctx: Context<'_, '_, 'info, 'info, SettleUsersBatch<'info>>,
        args: SettleUsersBatchArgs,
    ) -> Result<()> {
        settle_users_batch_handler(ctx, args)
    }

    pub fn set_game_over(ctx: Context<UpdateInstanceStatus>) -> Result<()> {
        set_game_over_handler(ctx)
    }
}
