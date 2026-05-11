use anchor_lang::prelude::*;

#[event]
pub struct FactoryInitialized {
    pub owner: Pubkey,
    pub dev_wallet: Pubkey,
    pub master_wallet: Pubkey,
    pub operator_wallet: Pubkey,
}

#[event]
pub struct AdminAdded {
    pub admin: Pubkey,
}

#[event]
pub struct AdminRemoved {
    pub admin: Pubkey,
}

#[event]
pub struct GlobalWalletsUpdated {
    pub dev_wallet: Pubkey,
    pub master_wallet: Pubkey,
    pub operator_wallet: Pubkey,
}

#[event]
pub struct InstanceDeployed {
    pub instance_id: u64,
}

#[event]
pub struct InstanceStatusChanged {
    pub instance_id: u64,
    pub status: u8,
}

#[event]
pub struct TicketPurchased {
    pub instance_id: u64,
    pub ticket_id: u64,
    pub owner: Pubkey,
    pub insured: bool,
}

#[event]
pub struct SettlementExecuted {
    pub settlement_id: [u8; 32],
    pub instance_id: u64,
    pub ticket_id: u64,
    pub kind: u8,
}

#[event]
pub struct GlobalLiquidityWithdrawn {
    pub mint: Pubkey,
    pub amount: u64,
    pub master_wallet: Pubkey,
}

#[event]
pub struct InstanceClosed {
    pub instance_id: u64,
    pub recipient: Pubkey,
}
