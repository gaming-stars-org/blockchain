# 03 - State Model and PDA Design

## Account Schemas

## `FactoryState`

- `owner: Pubkey`
- `dev_wallet: Pubkey`
- `master_wallet: Pubkey`
- `operator_wallet: Pubkey`
- `instance_count: u64`
- `program_version: u16`
- `created_at: i64`
- `updated_at: i64`
- `bump: u8`

## `GameInstance`

- `instance_id: u64`
- `status: InstanceStatus` (`active`, `paused`, `game_over`)
- `ticket_price: u64`
- `entry_fee: u64`
- `insurance_premium: u64`
- `payout_ratio_num: u16`
- `payout_ratio_den: u16`
- `accepted_mints: Vec<Pubkey>`
- `insurance_mint: Pubkey` (USDT only)
- `last_activity_ts: i64`
- `game_duration_secs: i64`
- `user_ttl_secs: i64`
- `pause_started_at: Option<i64>`
- `cumulative_paused_secs: i64`
- `next_ticket_id: u64`
- `created_at: i64`
- `updated_at: i64`
- `bump: u8`

## `TicketRecord`

- `instance_id: u64`
- `ticket_id: u64`
- `owner: Pubkey`
- `entry_mint: Pubkey`
- `entry_mode: EntryMode` (`paid`, `sponsored`)
- `paid_by: Pubkey` (actual payer authority for entry principal+fee)
- `principal_amount: u64`
- `insured: bool`
- `created_at: i64`
- `status: TicketStatus` (`active`, `paid`, `refunded`, `forfeited`)
- `resolved_at: Option<i64>`
- `resolution_kind: Option<ResolutionKind>`
- `external_ref: Option<[u8; 32]>`
- `bump: u8`

## `SettlementReceipt`

- `settlement_id: [u8; 32]`
- `instance_id: u64`
- `ticket_id: u64`
- `kind: SettlementKind` (`payout`, `refund`, `forfeit`)
- `payload_hash: [u8; 32]`
- `executor: Pubkey`
- `executed_at: i64`
- `bump: u8`

## PDA Seeds

## Factory

- `FactoryState`: `['factory-state']`

## Instance

- `GameInstance`: `['instance', instance_id_le_bytes]`
- `InstanceAuthority`: `['instance-authority', instance_pubkey]`

## Treasury Vaults

- Per instance + mint token account authority = `InstanceAuthority`
- Token account derivation seed recommendation:
  - `['treasury-vault', instance_pubkey, mint_pubkey]`

## Global Liquidity Vault (USDT)

- Authority PDA: `['liquidity-authority']`
- USDT vault token account: `['global-liquidity-vault', usdt_mint_pubkey]`

## Ticket

- `TicketRecord`: `['ticket', instance_pubkey, ticket_id_le_bytes]`

## Settlement Receipt

- `SettlementReceipt`: `['settlement', settlement_id]`

`settlement_id` is globally unique. Do not namespace by instance to avoid accidental replay across instances.

## Status Transition Rules

## InstanceStatus

- `active -> paused`
- `paused -> active`
- `active -> game_over`
- `paused -> game_over`
- No transition out of `game_over`.

## TicketStatus

- `active -> paid`
- `active -> refunded`
- `active -> forfeited`
- Terminal states are final and immutable.

## Schema Versioning

- Every main account includes a `program_version` or implicit discriminator versioning policy.
- Backward-compatible extension rule:
  - append fields only
  - never reorder existing fields
  - gate new behavior by version checks
