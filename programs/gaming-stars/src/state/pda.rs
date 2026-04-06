use anchor_lang::prelude::*;

use crate::constants::{
    ACTIVE_ENTRY_SEED, FACTORY_STATE_SEED, GLOBAL_LIQUIDITY_VAULT_SEED, INSTANCE_AUTHORITY_SEED,
    INSTANCE_SEED, LIQUIDITY_AUTHORITY_SEED, SETTLEMENT_RECEIPT_SEED, TICKET_RECORD_SEED,
    TREASURY_VAULT_SEED,
};

pub fn instance_id_seed(instance_id: u64) -> [u8; 8] {
    instance_id.to_le_bytes()
}

pub fn derive_factory_state(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[FACTORY_STATE_SEED], program_id)
}

pub fn derive_game_instance(program_id: &Pubkey, instance_id: u64) -> (Pubkey, u8) {
    let instance_seed = instance_id_seed(instance_id);
    Pubkey::find_program_address(&[INSTANCE_SEED, &instance_seed], program_id)
}

pub fn derive_instance_authority(program_id: &Pubkey, instance: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[INSTANCE_AUTHORITY_SEED, instance.as_ref()], program_id)
}

pub fn derive_treasury_vault(
    program_id: &Pubkey,
    instance: &Pubkey,
    mint: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[TREASURY_VAULT_SEED, instance.as_ref(), mint.as_ref()],
        program_id,
    )
}

pub fn derive_liquidity_authority(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[LIQUIDITY_AUTHORITY_SEED], program_id)
}

pub fn derive_global_liquidity_vault(program_id: &Pubkey, mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[GLOBAL_LIQUIDITY_VAULT_SEED, mint.as_ref()], program_id)
}

pub fn derive_ticket_record(
    program_id: &Pubkey,
    instance: &Pubkey,
    owner: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[TICKET_RECORD_SEED, instance.as_ref(), owner.as_ref()],
        program_id,
    )
}

pub fn derive_settlement_receipt(program_id: &Pubkey, settlement_id: &[u8; 32]) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[SETTLEMENT_RECEIPT_SEED, settlement_id], program_id)
}

pub fn derive_active_entry(program_id: &Pubkey, instance: &Pubkey, owner: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[ACTIVE_ENTRY_SEED, instance.as_ref(), owner.as_ref()],
        program_id,
    )
}
