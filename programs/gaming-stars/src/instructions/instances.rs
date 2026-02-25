use anchor_lang::prelude::*;

use crate::{
    constants::{FACTORY_STATE_SEED, INSTANCE_SEED, MAX_ACCEPTED_MINTS, MAX_INSURANCE_MINTS},
    errors::GamingStarsError,
    events::{InstanceDeployed, InstanceStatusChanged},
    instructions::guards,
    state::{
        transition_to_active, transition_to_game_over, transition_to_paused, FactoryState,
        GameInstance, InstanceStatus,
    },
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct DeployInstanceArgs {
    pub instance_id: u64,
    pub ticket_price: u64,
    pub entry_fee: u64,
    pub insurance_premium: u64,
    pub max_insured_tickets: u32,
    pub payout_ratio_num: u16,
    pub payout_ratio_den: u16,
    pub game_duration_secs: i64,
    pub user_ttl_secs: i64,
    pub accepted_mints: Vec<Pubkey>,
    pub insurance_mints: Vec<Pubkey>,
}

#[derive(Accounts)]
#[instruction(args: DeployInstanceArgs)]
pub struct DeployInstance<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [FACTORY_STATE_SEED], bump = factory_state.bump)]
    pub factory_state: Account<'info, FactoryState>,
    #[account(
        init,
        payer = authority,
        space = GameInstance::SPACE,
        seeds = [INSTANCE_SEED, &args.instance_id.to_le_bytes()],
        bump
    )]
    pub instance: Account<'info, GameInstance>,
    pub system_program: Program<'info, System>,
}

pub fn deploy_handler(ctx: Context<DeployInstance>, args: DeployInstanceArgs) -> Result<()> {
    guards::assert_owner_or_admin(&ctx.accounts.factory_state, &ctx.accounts.authority.key())?;

    require!(args.payout_ratio_den > 0, GamingStarsError::InvalidAmount);
    require!(
        args.accepted_mints.len() <= MAX_ACCEPTED_MINTS && !args.accepted_mints.is_empty(),
        GamingStarsError::InvalidMint
    );
    require!(
        args.insurance_mints.len() <= MAX_INSURANCE_MINTS && !args.insurance_mints.is_empty(),
        GamingStarsError::InvalidInsuranceMint
    );

    let now_ts = Clock::get()?.unix_timestamp;
    let factory = &mut ctx.accounts.factory_state;
    let instance = &mut ctx.accounts.instance;

    instance.instance_id = args.instance_id;
    instance.status = InstanceStatus::Active;
    instance.ticket_price = args.ticket_price;
    instance.entry_fee = args.entry_fee;
    instance.insurance_premium = args.insurance_premium;
    instance.max_insured_tickets = args.max_insured_tickets;
    instance.insured_tickets_count = 0;
    instance.payout_ratio_num = args.payout_ratio_num;
    instance.payout_ratio_den = args.payout_ratio_den;
    instance.accepted_mints = args.accepted_mints;
    instance.insurance_mints = args.insurance_mints;
    instance.last_activity_ts = now_ts;
    instance.game_duration_secs = args.game_duration_secs;
    instance.user_ttl_secs = args.user_ttl_secs;
    instance.pause_started_at = None;
    instance.cumulative_paused_secs = 0;
    instance.next_ticket_id = 0;
    instance.created_at = now_ts;
    instance.updated_at = now_ts;
    instance.bump = ctx.bumps.instance;

    factory.instance_count = factory
        .instance_count
        .checked_add(1)
        .ok_or(GamingStarsError::ArithmeticOverflow)?;
    factory.updated_at = now_ts;

    emit!(InstanceDeployed {
        instance_id: instance.instance_id,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateInstanceStatus<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [FACTORY_STATE_SEED], bump = factory_state.bump)]
    pub factory_state: Account<'info, FactoryState>,
    #[account(mut, seeds = [INSTANCE_SEED, &instance.instance_id.to_le_bytes()], bump = instance.bump)]
    pub instance: Account<'info, GameInstance>,
}

pub fn freeze_handler(ctx: Context<UpdateInstanceStatus>) -> Result<()> {
    guards::assert_owner_or_admin(&ctx.accounts.factory_state, &ctx.accounts.authority.key())?;
    let now_ts = Clock::get()?.unix_timestamp;
    transition_to_paused(&mut ctx.accounts.instance, now_ts)?;

    emit!(InstanceStatusChanged {
        instance_id: ctx.accounts.instance.instance_id,
        status: ctx.accounts.instance.status as u8,
    });

    Ok(())
}

pub fn unfreeze_handler(ctx: Context<UpdateInstanceStatus>) -> Result<()> {
    guards::assert_owner_or_admin(&ctx.accounts.factory_state, &ctx.accounts.authority.key())?;
    let now_ts = Clock::get()?.unix_timestamp;
    transition_to_active(&mut ctx.accounts.instance, now_ts)?;

    emit!(InstanceStatusChanged {
        instance_id: ctx.accounts.instance.instance_id,
        status: ctx.accounts.instance.status as u8,
    });

    Ok(())
}

pub fn set_game_over_handler(ctx: Context<UpdateInstanceStatus>) -> Result<()> {
    guards::assert_operator_wallet(&ctx.accounts.factory_state, &ctx.accounts.authority.key())?;
    let now_ts = Clock::get()?.unix_timestamp;
    transition_to_game_over(&mut ctx.accounts.instance, now_ts)?;

    emit!(InstanceStatusChanged {
        instance_id: ctx.accounts.instance.instance_id,
        status: ctx.accounts.instance.status as u8,
    });

    Ok(())
}
