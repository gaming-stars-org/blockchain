use anchor_lang::prelude::*;

use crate::{
    errors::GamingStarsError,
    state::{GameInstance, InstanceStatus, ResolutionKind, TicketRecord, TicketStatus},
};

pub fn transition_to_paused(instance: &mut GameInstance, now_ts: i64) -> Result<()> {
    require!(
        instance.status == InstanceStatus::Active,
        GamingStarsError::InstanceNotActive
    );
    instance.status = InstanceStatus::Paused;
    instance.pause_started_at = Some(now_ts);
    instance.updated_at = now_ts;
    Ok(())
}

pub fn transition_to_active(instance: &mut GameInstance, now_ts: i64) -> Result<()> {
    require!(
        instance.status == InstanceStatus::Paused,
        GamingStarsError::InstanceNotActive
    );
    if let Some(pause_started_at) = instance.pause_started_at {
        let paused_for = now_ts
            .checked_sub(pause_started_at)
            .ok_or(GamingStarsError::ArithmeticOverflow)?;
        instance.cumulative_paused_secs = instance
            .cumulative_paused_secs
            .checked_add(paused_for)
            .ok_or(GamingStarsError::ArithmeticOverflow)?;
    }
    instance.status = InstanceStatus::Active;
    instance.pause_started_at = None;
    instance.updated_at = now_ts;
    Ok(())
}

pub fn transition_to_game_over(instance: &mut GameInstance, now_ts: i64) -> Result<()> {
    require!(
        instance.status != InstanceStatus::GameOver,
        GamingStarsError::GameOver
    );
    if instance.status == InstanceStatus::Paused {
        transition_to_active(instance, now_ts)?;
    }
    instance.status = InstanceStatus::GameOver;
    instance.updated_at = now_ts;
    Ok(())
}

pub fn mark_ticket_paid(
    ticket: &mut TicketRecord,
    now_ts: i64,
    kind: ResolutionKind,
) -> Result<()> {
    require!(
        ticket.status == TicketStatus::Active,
        GamingStarsError::InvalidTicketState
    );
    ticket.status = TicketStatus::Paid;
    ticket.resolved_at = Some(now_ts);
    ticket.resolution_kind = Some(kind);
    Ok(())
}

pub fn mark_ticket_refunded(
    ticket: &mut TicketRecord,
    now_ts: i64,
    kind: ResolutionKind,
) -> Result<()> {
    require!(
        ticket.status == TicketStatus::Active,
        GamingStarsError::InvalidTicketState
    );
    ticket.status = TicketStatus::Refunded;
    ticket.resolved_at = Some(now_ts);
    ticket.resolution_kind = Some(kind);
    Ok(())
}

pub fn mark_ticket_forfeited(
    ticket: &mut TicketRecord,
    now_ts: i64,
    kind: ResolutionKind,
) -> Result<()> {
    require!(
        ticket.status == TicketStatus::Active,
        GamingStarsError::InvalidTicketState
    );
    ticket.status = TicketStatus::Forfeited;
    ticket.resolved_at = Some(now_ts);
    ticket.resolution_kind = Some(kind);
    Ok(())
}
