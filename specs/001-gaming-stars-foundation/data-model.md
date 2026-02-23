# Data Model: Gaming Stars Foundation

## Entities

### FactoryState

- `owner: Pubkey`
- `admins: Vec<Pubkey>`
- `dev_wallet: Pubkey`
- `master_wallet: Pubkey`
- `operator_wallet: Pubkey`
- `instance_count: u64`
- `program_version: u16`
- `created_at: i64`
- `updated_at: i64`
- `bump: u8`

### GameInstance

- `instance_id: u64`
- `status: InstanceStatus` (`active|paused|game_over`)
- `ticket_price: u64`
- `entry_fee: u64`
- `insurance_premium: u64`
- `payout_ratio_num: u16`
- `payout_ratio_den: u16`
- `accepted_mints: Vec<Pubkey>`
- `insurance_mints: Vec<Pubkey>` (supported set limited to USDT/USDC)
- `last_activity_ts: i64`
- `game_duration_secs: i64`
- `user_ttl_secs: i64`
- `pause_started_at: Option<i64>`
- `cumulative_paused_secs: i64`
- `next_ticket_id: u64`
- `created_at: i64`
- `updated_at: i64`
- `bump: u8`

### TicketRecord

- `instance_id: u64`
- `ticket_id: u64`
- `owner: Pubkey`
- `entry_mint: Pubkey`
- `entry_mode: EntryMode` (`paid|sponsored`)
- `paid_by: Pubkey`
- `principal_amount: u64`
- `insured: bool`
- `created_at: i64`
- `status: TicketStatus` (`active|paid|refunded|forfeited`)
- `resolved_at: Option<i64>`
- `resolution_kind: Option<ResolutionKind>`
- `external_ref: Option<[u8; 32]>`
- `bump: u8`

### SettlementReceipt

- `settlement_id: [u8; 32]`
- `instance_id: u64`
- `ticket_id: u64`
- `kind: SettlementKind` (`payout|refund|forfeit`)
- `payload_hash: [u8; 32]`
- `executor: Pubkey`
- `executed_at: i64`
- `bump: u8`

## PDA Derivation

- `FactoryState`: `['factory-state']`
- `GameInstance`: `['instance', instance_id_le_bytes]`
- `InstanceAuthority`: `['instance-authority', instance_pubkey]`
- `TreasuryVault`: `['treasury-vault', instance_pubkey, mint_pubkey]`
- `LiquidityAuthority`: `['liquidity-authority']`
- `GlobalLiquidityVault`: `['global-liquidity-vault', insurance_mint_pubkey]`
- `TicketRecord`: `['ticket', instance_pubkey, ticket_id_le_bytes]`
- `SettlementReceipt`: `['settlement', settlement_id]`

## State Transitions

### InstanceStatus

- `active -> paused`
- `paused -> active`
- `active -> game_over`
- `paused -> game_over`
- `game_over` is terminal

### TicketStatus

- `active -> paid`
- `active -> refunded`
- `active -> forfeited`
- Terminal states are immutable

## Invariants

- Principal can leave treasury only through payout/forfeit settlement.
- Refunds must source from global liquidity vault matching refund mint (USDT/USDC only).
- Beneficiary for payout/refund must equal `ticket.owner`.
- Settlement ID is globally unique and consumed once.
- Pause blocks all money-moving instructions.

## Versioning Rule

- Append-only account field evolution.
- No reordering existing fields.
- Guard new behavior with `program_version` checks.
