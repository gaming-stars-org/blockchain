use anchor_lang::prelude::*;

use crate::constants::{EXTERNAL_REF_LEN, MAX_ACCEPTED_MINTS, MAX_ADMINS, MAX_INSURANCE_MINTS};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum InstanceStatus {
    Active = 0,
    Paused = 1,
    GameOver = 2,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum EntryMode {
    Paid = 0,
    Sponsored = 1,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum TicketStatus {
    Active = 0,
    Paid = 1,
    Refunded = 2,
    Forfeited = 3,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum ResolutionKind {
    Unknown = 0,
    Win = 1,
    Loss = 2,
    Timeout = 3,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum SettlementKind {
    Payout = 0,
    Refund = 1,
    Forfeit = 2,
}

#[account]
pub struct FactoryState {
    pub owner: Pubkey,
    pub admins: Vec<Pubkey>,
    pub dev_wallet: Pubkey,
    pub master_wallet: Pubkey,
    pub operator_wallet: Pubkey,
    pub instance_count: u64,
    pub program_version: u16,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl FactoryState {
    pub const SPACE: usize = 8 + 32 + 4 + (MAX_ADMINS * 32) + 32 + 32 + 32 + 8 + 2 + 8 + 8 + 1;

    pub fn is_admin(&self, key: &Pubkey) -> bool {
        self.admins.iter().any(|admin| admin == key)
    }
}

#[account]
pub struct GameInstance {
    pub instance_id: u64,
    pub status: InstanceStatus,
    pub ticket_price: u64,
    pub entry_fee: u64,
    pub insurance_premium: u64,
    pub max_insured_tickets: u32,
    pub insured_tickets_count: u32,
    pub payout_ratio_num: u16,
    pub payout_ratio_den: u16,
    pub accepted_mints: Vec<Pubkey>,
    pub insurance_mints: Vec<Pubkey>,
    pub last_activity_ts: i64,
    pub game_duration_secs: i64,
    pub user_ttl_secs: i64,
    pub pause_started_at: Option<i64>,
    pub cumulative_paused_secs: i64,
    pub next_ticket_id: u64,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl GameInstance {
    pub const SPACE: usize = 8
        + 8
        + 1
        + 8
        + 8
        + 8
        + 4
        + 4
        + 2
        + 2
        + 4
        + (MAX_ACCEPTED_MINTS * 32)
        + 4
        + (MAX_INSURANCE_MINTS * 32)
        + 8
        + 8
        + 8
        + 1
        + 8
        + 8
        + 8
        + 8
        + 1;

    pub fn is_active(&self) -> bool {
        self.status == InstanceStatus::Active
    }
}

#[account]
pub struct TicketRecord {
    pub instance_id: u64,
    pub ticket_id: u64,
    pub owner: Pubkey,
    pub entry_mint: Pubkey,
    pub entry_mode: EntryMode,
    pub paid_by: Pubkey,
    pub principal_amount: u64,
    pub insured: bool,
    pub created_at: i64,
    pub status: TicketStatus,
    pub resolved_at: Option<i64>,
    pub resolution_kind: Option<ResolutionKind>,
    pub external_ref: Option<[u8; EXTERNAL_REF_LEN]>,
    pub bump: u8,
}

impl TicketRecord {
    pub const SPACE: usize =
        8 + 8 + 8 + 32 + 32 + 1 + 32 + 8 + 1 + 8 + 1 + 1 + 8 + 1 + 1 + 1 + EXTERNAL_REF_LEN + 1;

    pub fn is_active(&self) -> bool {
        self.status == TicketStatus::Active
    }
}

#[account]
pub struct SettlementReceipt {
    pub settlement_id: [u8; 32],
    pub instance_id: u64,
    pub ticket_id: u64,
    pub kind: SettlementKind,
    pub payload_hash: [u8; 32],
    pub executor: Pubkey,
    pub executed_at: i64,
    pub bump: u8,
}

impl SettlementReceipt {
    pub const SPACE: usize = 8 + 32 + 8 + 8 + 1 + 32 + 32 + 8 + 1;
}
