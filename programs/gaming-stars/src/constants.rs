use anchor_lang::prelude::*;

pub const FACTORY_STATE_SEED: &[u8] = b"factory-state";
pub const INSTANCE_SEED: &[u8] = b"instance";
pub const INSTANCE_AUTHORITY_SEED: &[u8] = b"instance-authority";
pub const TREASURY_VAULT_SEED: &[u8] = b"treasury-vault";
pub const LIQUIDITY_AUTHORITY_SEED: &[u8] = b"liquidity-authority";
pub const GLOBAL_LIQUIDITY_VAULT_SEED: &[u8] = b"global-liquidity-vault";
pub const TICKET_RECORD_SEED: &[u8] = b"ticket";
pub const SETTLEMENT_RECEIPT_SEED: &[u8] = b"settlement";

pub const PROGRAM_VERSION: u16 = 1;
pub const MAX_ADMINS: usize = 32;
pub const MAX_ACCEPTED_MINTS: usize = 16;
pub const MAX_INSURANCE_MINTS: usize = 2;

pub const EXTERNAL_REF_LEN: usize = 32;

pub const EMPTY_PUBKEY: Pubkey = Pubkey::new_from_array([0u8; 32]);
