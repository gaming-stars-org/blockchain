# Gaming Stars - Smart Contract Documentation

> **Program ID:** `5X2xYZ1oAebuc8NNMHa3LNgATow8QoFPuFraji93psJp`
>
> **Framework:** Anchor `0.32.1` (Solana)
>
> **Token Support:** SPL Token + Token-2022
>
> Last updated: 2026-03-11

---

## Overview

Gaming Stars is a Solana smart contract that manages a gaming platform with ticket-based entries, insurance mechanics, and multi-token settlement. The program uses a factory pattern where a single `FactoryState` governs multiple `GameInstance` deployments, each with its own treasury vaults and configuration.

### Architecture

```
FactoryState (singleton)
├── owner (super-admin)
├── admins[] (up to 32)
├── dev_wallet / master_wallet / operator_wallet
│
├── GameInstance #0
│   ├── TicketRecord #0..N
│   ├── ActiveEntry (per user, per game)
│   ├── TreasuryVault (per accepted mint)
│   └── SettlementReceipt (per settlement)
│
├── GameInstance #1
│   └── ...
│
├── GlobalLiquidityVault (per mint, shared across instances)
└── LiquidityAuthority (PDA signer for liquidity vaults)
```

---

## Constants

| Name | Value | Description |
|------|-------|-------------|
| `PROGRAM_VERSION` | `1` | Current program version |
| `MAX_ADMINS` | `32` | Maximum number of admin wallets |
| `MAX_ACCEPTED_MINTS` | `16` | Maximum accepted token mints per instance |
| `MAX_INSURANCE_MINTS` | `2` | Maximum insurance-eligible mints per instance |
| `EXTERNAL_REF_LEN` | `32` | Byte length of external reference field |

---

## Accounts

### FactoryState

Global configuration account. Singleton PDA derived from `["factory-state"]`.

```rust
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
```

| Field | Type | Description |
|-------|------|-------------|
| `owner` | `Pubkey` | Super-admin with full control. Set at initialization, cannot be changed. |
| `admins` | `Vec<Pubkey>` | Admin wallets that can deploy instances and manage vaults. Max 32. |
| `dev_wallet` | `Pubkey` | Receives entry fees from ticket purchases. |
| `master_wallet` | `Pubkey` | Can top up the global liquidity vault. |
| `operator_wallet` | `Pubkey` | Co-signs ticket purchases and executes settlements. |
| `instance_count` | `u64` | Total number of deployed game instances. |
| `program_version` | `u16` | Program version at time of initialization. |
| `created_at` | `i64` | Unix timestamp of factory creation. |
| `updated_at` | `i64` | Unix timestamp of last update. |
| `bump` | `u8` | PDA bump seed. |

---

### GameInstance

Represents a single game with its own configuration, pricing, and ticket tracking. PDA derived from `["instance", instance_id.to_le_bytes()]`.

```rust
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
```

| Field | Type | Description |
|-------|------|-------------|
| `instance_id` | `u64` | Unique identifier for this game instance. |
| `status` | `InstanceStatus` | Current status: `Active (0)`, `Paused (1)`, or `GameOver (2)`. |
| `ticket_price` | `u64` | Principal amount deposited into the treasury vault per ticket. |
| `entry_fee` | `u64` | Fee sent to the dev wallet per ticket purchase. |
| `insurance_premium` | `u64` | Premium sent to the global liquidity vault for insured tickets. |
| `max_insured_tickets` | `u32` | Maximum number of insured tickets allowed for this instance. |
| `insured_tickets_count` | `u32` | Current count of insured tickets. |
| `payout_ratio_num` | `u16` | Payout ratio numerator. |
| `payout_ratio_den` | `u16` | Payout ratio denominator. Must be > 0. |
| `accepted_mints` | `Vec<Pubkey>` | Token mints accepted for entry. Max 16. |
| `insurance_mints` | `Vec<Pubkey>` | Token mints eligible for insurance. Must be a subset of `accepted_mints`. Max 2. |
| `last_activity_ts` | `i64` | Timestamp of last ticket purchase. |
| `game_duration_secs` | `i64` | Total game duration in seconds. |
| `user_ttl_secs` | `i64` | Time-to-live for user participation in seconds. |
| `pause_started_at` | `Option<i64>` | Timestamp when the instance was paused. `None` if not paused. |
| `cumulative_paused_secs` | `i64` | Total time the instance has been paused. |
| `next_ticket_id` | `u64` | Auto-incrementing ticket ID counter. |
| `created_at` | `i64` | Unix timestamp of instance creation. |
| `updated_at` | `i64` | Unix timestamp of last update. |
| `bump` | `u8` | PDA bump seed. |

---

### TicketRecord

Represents a user's ticket in a game instance. PDA derived from `["ticket", instance.key(), ticket_id.to_le_bytes()]`.

```rust
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
    pub external_ref: Option<[u8; 32]>,
    pub bump: u8,
}
```

| Field | Type | Description |
|-------|------|-------------|
| `instance_id` | `u64` | ID of the game instance this ticket belongs to. |
| `ticket_id` | `u64` | Unique ticket identifier within the instance. |
| `owner` | `Pubkey` | The user wallet that owns this ticket. |
| `entry_mint` | `Pubkey` | Token mint used for this ticket's entry. |
| `entry_mode` | `EntryMode` | `Paid (0)` if user paid, `Sponsored (1)` if operator paid. |
| `paid_by` | `Pubkey` | Wallet that funded the ticket (user or operator). |
| `principal_amount` | `u64` | The ticket price amount deposited to treasury. |
| `insured` | `bool` | Whether the ticket has insurance coverage. |
| `created_at` | `i64` | Unix timestamp of ticket creation. |
| `status` | `TicketStatus` | `Active (0)`, `Paid (1)`, `Refunded (2)`, or `Forfeited (3)`. |
| `resolved_at` | `Option<i64>` | Timestamp of settlement. `None` while active. |
| `resolution_kind` | `Option<ResolutionKind>` | `Win (1)`, `Loss (2)`, or `Timeout (3)`. `None` while active. |
| `external_ref` | `Option<[u8; 32]>` | Optional external reference (e.g., off-chain game ID). |
| `bump` | `u8` | PDA bump seed. |

---

### ActiveEntry

Guard account ensuring one active ticket per user per game instance. Closed upon settlement. PDA derived from `["active-entry", instance.key(), user.key()]`.

```rust
pub struct ActiveEntry {
    pub instance_id: u64,
    pub owner: Pubkey,
    pub bump: u8,
}
```

| Field | Type | Description |
|-------|------|-------------|
| `instance_id` | `u64` | ID of the game instance. |
| `owner` | `Pubkey` | The user wallet. |
| `bump` | `u8` | PDA bump seed. |

---

### SettlementReceipt

Immutable record of a completed settlement. Prevents duplicate settlements. PDA derived from `["settlement", settlement_id]`.

```rust
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
```

| Field | Type | Description |
|-------|------|-------------|
| `settlement_id` | `[u8; 32]` | Unique settlement identifier. |
| `instance_id` | `u64` | ID of the game instance. |
| `ticket_id` | `u64` | ID of the settled ticket. |
| `kind` | `SettlementKind` | `Payout (0)`, `Refund (1)`, or `Forfeit (2)`. |
| `payload_hash` | `[u8; 32]` | Hash of the settlement payload for verification. |
| `executor` | `Pubkey` | Operator wallet that executed the settlement. |
| `executed_at` | `i64` | Unix timestamp of execution. |
| `bump` | `u8` | PDA bump seed. |

---

## Enums

### InstanceStatus

```rust
pub enum InstanceStatus {
    Active = 0,
    Paused = 1,
    GameOver = 2,
}
```

### EntryMode

```rust
pub enum EntryMode {
    Paid = 0,
    Sponsored = 1,
}
```

### TicketStatus

```rust
pub enum TicketStatus {
    Active = 0,
    Paid = 1,
    Refunded = 2,
    Forfeited = 3,
}
```

### ResolutionKind

```rust
pub enum ResolutionKind {
    Unknown = 0,
    Win = 1,
    Loss = 2,
    Timeout = 3,
}
```

### SettlementKind

```rust
pub enum SettlementKind {
    Payout = 0,
    Refund = 1,
    Forfeit = 2,
}
```

---

## PDA Seeds Reference

| Account | Seeds | Description |
|---------|-------|-------------|
| `FactoryState` | `["factory-state"]` | Singleton global config |
| `GameInstance` | `["instance", instance_id (8 bytes LE)]` | Per-game config |
| `InstanceAuthority` | `["instance-authority", instance.key()]` | Signer for treasury vault transfers |
| `TreasuryVault` | `["treasury-vault", instance.key(), mint.key()]` | Per-instance, per-mint token vault |
| `LiquidityAuthority` | `["liquidity-authority"]` | Signer for global liquidity vault transfers |
| `GlobalLiquidityVault` | `["global-liquidity-vault", mint.key()]` | Per-mint insurance liquidity pool |
| `TicketRecord` | `["ticket", instance.key(), ticket_id (8 bytes LE)]` | Per-ticket state |
| `ActiveEntry` | `["active-entry", instance.key(), user.key()]` | One active ticket per user per game |
| `SettlementReceipt` | `["settlement", settlement_id (32 bytes)]` | Idempotency guard for settlements |

---

## Instructions

### initialize_factory

Initializes the global factory state. Can only be called once (PDA is a singleton).

```rust
pub fn initialize_factory(
    ctx: Context<InitializeFactory>,
    dev_wallet: Pubkey,
    master_wallet: Pubkey,
    operator_wallet: Pubkey,
) -> Result<()>
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `dev_wallet` | `Pubkey` | Address that receives entry fees from ticket purchases. |
| `master_wallet` | `Pubkey` | Address authorized to top up the global liquidity vault. |
| `operator_wallet` | `Pubkey` | Address that co-signs purchases and executes settlements. |

**Accounts**

| Name | Type | Mutable | Signer | Description |
|------|------|---------|--------|-------------|
| `owner` | `Signer` | Yes | Yes | Deployer who becomes the factory owner. Pays for account rent. |
| `factory_state` | `Account<FactoryState>` | Yes (init) | No | The factory state PDA to be initialized. |
| `system_program` | `Program<System>` | No | No | Solana system program. |

**Access Control:** None (first-time initialization only; PDA ensures singleton).

---

### add_admin

Adds an admin wallet to the factory admin list.

```rust
pub fn add_admin(ctx: Context<UpdateAdmin>, admin_wallet: Pubkey) -> Result<()>
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `admin_wallet` | `Pubkey` | Address to grant admin privileges. |

**Accounts**

| Name | Type | Mutable | Signer | Description |
|------|------|---------|--------|-------------|
| `owner` | `Signer` | Yes | Yes | Must be the factory owner. |
| `factory_state` | `Account<FactoryState>` | Yes | No | The factory state PDA. |

**Access Control:** Owner only.

**Errors:**
- `AdminAlreadyExists` — Admin already in the list.
- `ImmutableConfig` — Admin list is full (32).

---

### remove_admin

Removes an admin wallet from the factory admin list.

```rust
pub fn remove_admin(ctx: Context<UpdateAdmin>, admin_wallet: Pubkey) -> Result<()>
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `admin_wallet` | `Pubkey` | Address to revoke admin privileges from. |

**Accounts**

| Name | Type | Mutable | Signer | Description |
|------|------|---------|--------|-------------|
| `owner` | `Signer` | Yes | Yes | Must be the factory owner. |
| `factory_state` | `Account<FactoryState>` | Yes | No | The factory state PDA. |

**Access Control:** Owner only.

**Errors:**
- `AdminNotFound` — Admin not in the list.

---

### update_global_wallets

Updates the dev, master, and/or operator wallet addresses. Accepts optional fields — only provided fields are updated.

```rust
pub fn update_global_wallets(
    ctx: Context<UpdateGlobalWallets>,
    args: WalletUpdateArgs,
) -> Result<()>
```

**Parameters (WalletUpdateArgs)**

| Name | Type | Description |
|------|------|-------------|
| `new_dev_wallet` | `Option<Pubkey>` | New dev wallet address. Must not be the zero address. |
| `new_master_wallet` | `Option<Pubkey>` | New master wallet address. Must not be the zero address. |
| `new_operator_wallet` | `Option<Pubkey>` | New operator wallet address. Must not be the zero address. |

**Accounts**

| Name | Type | Mutable | Signer | Description |
|------|------|---------|--------|-------------|
| `owner` | `Signer` | Yes | Yes | Must be the factory owner. |
| `factory_state` | `Account<FactoryState>` | Yes | No | The factory state PDA. |

**Access Control:** Owner only.

---

### deploy_instance

Deploys a new game instance with specified configuration. Creates treasury vaults and global liquidity vaults for each accepted mint via `remaining_accounts`.

```rust
pub fn deploy_instance<'info>(
    ctx: Context<'_, '_, '_, 'info, DeployInstance<'info>>,
    args: DeployInstanceArgs,
) -> Result<()>
```

**Parameters (DeployInstanceArgs)**

| Name | Type | Description |
|------|------|-------------|
| `instance_id` | `u64` | Unique identifier for the new instance. |
| `ticket_price` | `u64` | Principal amount per ticket (goes to treasury). |
| `entry_fee` | `u64` | Fee per ticket (goes to dev wallet). |
| `insurance_premium` | `u64` | Insurance premium per insured ticket (goes to global liquidity). |
| `max_insured_tickets` | `u32` | Maximum insured tickets allowed. |
| `payout_ratio_num` | `u16` | Payout ratio numerator. |
| `payout_ratio_den` | `u16` | Payout ratio denominator. Must be > 0. |
| `game_duration_secs` | `i64` | Game duration in seconds. |
| `user_ttl_secs` | `i64` | User time-to-live in seconds. |
| `accepted_mints` | `Vec<Pubkey>` | Token mints accepted for entry. 1–16 mints. |
| `insurance_mints` | `Vec<Pubkey>` | Mints eligible for insurance. Must be subset of `accepted_mints`. 1–2 mints. |

**Accounts**

| Name | Type | Mutable | Signer | Description |
|------|------|---------|--------|-------------|
| `authority` | `Signer` | Yes | Yes | Owner or admin. Pays for account rent. |
| `factory_state` | `Account<FactoryState>` | Yes | No | The factory state PDA. |
| `instance` | `Account<GameInstance>` | Yes (init) | No | The game instance PDA to be created. |
| `instance_authority` | `UncheckedAccount` | No | No | PDA used as treasury vault token owner. |
| `liquidity_authority` | `UncheckedAccount` | No | No | PDA used as global liquidity vault token owner. |
| `token_program` | `Interface<TokenInterface>` | No | No | SPL Token or Token-2022 program. |
| `system_program` | `Program<System>` | No | No | Solana system program. |

**Remaining Accounts:** For each accepted mint (in order), provide 3 accounts:
1. **Mint account** — The SPL token mint.
2. **Treasury vault** — PDA token account for per-instance funds.
3. **Global liquidity vault** — PDA token account for shared insurance pool.

**Access Control:** Owner or admin.

---

### freeze_instance

Pauses a game instance. Tickets cannot be purchased or settled while paused.

```rust
pub fn freeze_instance(ctx: Context<UpdateInstanceStatus>) -> Result<()>
```

**Accounts**

| Name | Type | Mutable | Signer | Description |
|------|------|---------|--------|-------------|
| `authority` | `Signer` | Yes | Yes | Owner or admin. |
| `factory_state` | `Account<FactoryState>` | No | No | The factory state PDA. |
| `instance` | `Account<GameInstance>` | Yes | No | The game instance to pause. |

**Access Control:** Owner or admin.

**Errors:**
- `InstanceNotActive` — Instance is not currently active.

---

### unfreeze_instance

Resumes a paused game instance. Accumulates the paused duration into `cumulative_paused_secs`.

```rust
pub fn unfreeze_instance(ctx: Context<UpdateInstanceStatus>) -> Result<()>
```

**Accounts**

| Name | Type | Mutable | Signer | Description |
|------|------|---------|--------|-------------|
| `authority` | `Signer` | Yes | Yes | Owner or admin. |
| `factory_state` | `Account<FactoryState>` | No | No | The factory state PDA. |
| `instance` | `Account<GameInstance>` | Yes | No | The game instance to resume. |

**Access Control:** Owner or admin.

**Errors:**
- `InstanceNotActive` — Instance is not currently paused.

---

### set_game_over

Marks a game instance as game over. If currently paused, unpauses first, then transitions to game over. Irreversible.

```rust
pub fn set_game_over(ctx: Context<UpdateInstanceStatus>) -> Result<()>
```

**Accounts**

| Name | Type | Mutable | Signer | Description |
|------|------|---------|--------|-------------|
| `authority` | `Signer` | Yes | Yes | Must be the operator wallet. |
| `factory_state` | `Account<FactoryState>` | No | No | The factory state PDA. |
| `instance` | `Account<GameInstance>` | Yes | No | The game instance to end. |

**Access Control:** Operator wallet only.

**Errors:**
- `GameOver` — Instance is already game over.

---

### buy_ticket

Purchases a ticket for a user in a game instance. Splits the total payment across treasury vault (ticket price), global liquidity vault (insurance premium, if insured), and dev wallet (entry fee). Requires operator co-signature.

```rust
pub fn buy_ticket(ctx: Context<BuyTicket>, args: BuyTicketArgs) -> Result<()>
```

**Parameters (BuyTicketArgs)**

| Name | Type | Description |
|------|------|-------------|
| `entry_mode` | `EntryMode` | `Paid` (user pays) or `Sponsored` (operator pays). |
| `entry_mint` | `Pubkey` | Token mint used for payment. Must be in instance's `accepted_mints`. |
| `insured` | `bool` | Whether the ticket includes insurance. |
| `entry_total_amount` | `u64` | Total amount = `ticket_price + insurance_premium + entry_fee`. Validated on-chain. |
| `insurance_premium_amount` | `u64` | Insurance premium. Must match `instance.insurance_premium` if insured, `0` otherwise. |
| `external_ref` | `Option<[u8; 32]>` | Optional external reference bytes. |

**Accounts**

| Name | Type | Mutable | Signer | Description |
|------|------|---------|--------|-------------|
| `user` | `Signer` | Yes | Yes | The ticket owner. Pays for PDA rent. |
| `operator` | `Signer` | No | Yes | Must be the factory operator wallet. Co-signs the purchase. |
| `payer_authority` | `Signer` | No | Yes | Token transfer authority. Must be `user` for `Paid` mode, `operator` for `Sponsored`. |
| `factory_state` | `Account<FactoryState>` | No | No | The factory state PDA. |
| `instance` | `Account<GameInstance>` | Yes | No | The game instance. Must be active and not game over. |
| `ticket_record` | `Account<TicketRecord>` | Yes (init) | No | The new ticket PDA. |
| `active_entry` | `Account<ActiveEntry>` | Yes (init) | No | Guard PDA ensuring one active ticket per user per game. |
| `entry_mint` | `InterfaceAccount<Mint>` | No | No | The SPL token mint. |
| `payer_entry_token_account` | `InterfaceAccount<TokenAccount>` | Yes | No | Payer's token account (source of funds). |
| `treasury_vault` | `InterfaceAccount<TokenAccount>` | Yes | No | Instance treasury vault for the entry mint. |
| `global_liquidity_vault` | `InterfaceAccount<TokenAccount>` | Yes | No | Global liquidity vault for insurance premiums. |
| `liquidity_authority` | `UncheckedAccount` | No | No | PDA owner of global liquidity vault. |
| `dev_wallet_token_account` | `InterfaceAccount<TokenAccount>` | Yes | No | Dev wallet's token account for entry fees. |
| `token_program` | `Interface<TokenInterface>` | No | No | SPL Token or Token-2022 program. |
| `system_program` | `Program<System>` | No | No | Solana system program. |

**Access Control:** Operator co-signature required.

**Token Flow:**
1. `ticket_price` → Treasury Vault
2. `insurance_premium` → Global Liquidity Vault (if insured)
3. `entry_fee` → Dev Wallet Token Account

**Errors:**
- `InstanceNotActive` — Game is paused or not active.
- `GameOver` — Game is over.
- `InvalidMint` — Mint not in accepted list or mint mismatch.
- `InvalidPayerAuthority` — Wrong payer for the entry mode.
- `SponsoredInsuranceNotAllowed` — Sponsored tickets cannot be insured.
- `MaxInsuredTicketsReached` — Insurance cap reached.
- `InvalidAmount` — Total amount doesn't match expected calculation.
- `ActiveTicketExists` — User already has an active ticket in this game (init of `active_entry` PDA fails).

---

### init_global_liquidity_vault

Initializes a global liquidity vault for a specific token mint. Shared across all game instances.

```rust
pub fn init_global_liquidity_vault(ctx: Context<InitGlobalLiquidityVault>) -> Result<()>
```

**Accounts**

| Name | Type | Mutable | Signer | Description |
|------|------|---------|--------|-------------|
| `authority` | `Signer` | Yes | Yes | Owner or admin. Pays for account rent. |
| `factory_state` | `Account<FactoryState>` | No | No | The factory state PDA. |
| `mint` | `InterfaceAccount<Mint>` | No | No | The token mint for this vault. |
| `global_liquidity_vault` | `InterfaceAccount<TokenAccount>` | Yes (init) | No | The vault PDA to be created. |
| `liquidity_authority` | `UncheckedAccount` | No | No | PDA that will own the vault. |
| `token_program` | `Interface<TokenInterface>` | No | No | SPL Token or Token-2022 program. |
| `system_program` | `Program<System>` | No | No | Solana system program. |

**Access Control:** Owner or admin.

---

### init_treasury_vault

Initializes a treasury vault for a specific game instance and token mint.

```rust
pub fn init_treasury_vault(ctx: Context<InitTreasuryVault>) -> Result<()>
```

**Accounts**

| Name | Type | Mutable | Signer | Description |
|------|------|---------|--------|-------------|
| `authority` | `Signer` | Yes | Yes | Owner or admin. Pays for account rent. |
| `factory_state` | `Account<FactoryState>` | No | No | The factory state PDA. |
| `instance` | `Account<GameInstance>` | No | No | The game instance this vault belongs to. |
| `mint` | `InterfaceAccount<Mint>` | No | No | Must be in the instance's `accepted_mints`. |
| `treasury_vault` | `InterfaceAccount<TokenAccount>` | Yes (init) | No | The vault PDA to be created. |
| `instance_authority` | `UncheckedAccount` | No | No | PDA that will own the vault. |
| `token_program` | `Interface<TokenInterface>` | No | No | SPL Token or Token-2022 program. |
| `system_program` | `Program<System>` | No | No | Solana system program. |

**Access Control:** Owner or admin.

**Errors:**
- `InvalidMint` — Mint not in the instance's accepted mints.

---

### topup_global_liquidity

Deposits tokens from the master wallet into the global liquidity vault.

```rust
pub fn topup_global_liquidity(
    ctx: Context<TopupGlobalLiquidity>,
    args: TopupGlobalLiquidityArgs,
) -> Result<()>
```

**Parameters (TopupGlobalLiquidityArgs)**

| Name | Type | Description |
|------|------|-------------|
| `mint` | `Pubkey` | Token mint to deposit. |
| `amount` | `u64` | Amount to deposit. Must be > 0. |

**Accounts**

| Name | Type | Mutable | Signer | Description |
|------|------|---------|--------|-------------|
| `master_wallet` | `Signer` | Yes | Yes | Must be the factory master wallet. |
| `factory_state` | `Account<FactoryState>` | No | No | The factory state PDA. |
| `mint` | `InterfaceAccount<Mint>` | No | No | The token mint. |
| `master_token_account` | `InterfaceAccount<TokenAccount>` | Yes | No | Master wallet's token account (source of funds). |
| `global_liquidity_vault` | `InterfaceAccount<TokenAccount>` | Yes | No | The global liquidity vault for this mint. |
| `liquidity_authority` | `UncheckedAccount` | No | No | PDA owner of the liquidity vault. |
| `token_program` | `Interface<TokenInterface>` | No | No | SPL Token or Token-2022 program. |

**Access Control:** Master wallet only.

**Errors:**
- `InvalidAmount` — Amount is 0.
- `InvalidMint` — Mint mismatch between accounts.

---

### settle_payout

Settles a ticket with a payout. Transfers tokens from the treasury vault to the ticket owner via one or more transfer legs. Closes the `ActiveEntry` account and creates a `SettlementReceipt`.

```rust
pub fn settle_payout<'info>(
    ctx: Context<'_, '_, 'info, 'info, SettlePayout<'info>>,
    args: SettlePayoutArgs,
) -> Result<()>
```

**Parameters (SettlePayoutArgs)**

| Name | Type | Description |
|------|------|-------------|
| `settlement_id` | `[u8; 32]` | Unique settlement identifier. Prevents duplicates. |
| `instance_id` | `u64` | Game instance ID. |
| `ticket_id` | `u64` | Ticket ID to settle. |
| `beneficiary` | `Pubkey` | Must match the ticket owner. |
| `legs` | `Vec<TransferLeg>` | Token transfer instructions (mint, amount, source vault, destination ATA). |
| `resolution_kind` | `ResolutionKind` | How the ticket was resolved (Win, Loss, Timeout). |
| `payload_hash` | `[u8; 32]` | Hash of the settlement payload for audit trail. |

**TransferLeg**

| Name | Type | Description |
|------|------|-------------|
| `mint` | `Pubkey` | Token mint for this transfer. |
| `amount` | `u64` | Amount to transfer. Must be > 0. |
| `source_vault` | `Pubkey` | Treasury vault PDA to transfer from. |
| `destination_ata` | `Pubkey` | Beneficiary's associated token account. |

**Accounts**

| Name | Type | Mutable | Signer | Description |
|------|------|---------|--------|-------------|
| `operator` | `Signer` | Yes | Yes | Must be the operator wallet. Pays for receipt rent. Receives closed `ActiveEntry` rent. |
| `factory_state` | `Account<FactoryState>` | No | No | The factory state PDA. |
| `instance` | `Account<GameInstance>` | Yes | No | The game instance. Must not be paused. |
| `ticket_record` | `Account<TicketRecord>` | Yes | No | The ticket to settle. Must be active. |
| `active_entry` | `Account<ActiveEntry>` | Yes | No | Closed upon settlement. Rent returned to operator. |
| `settlement_receipt` | `Account<SettlementReceipt>` | Yes (init) | No | Idempotency receipt PDA. |
| `instance_authority` | `UncheckedAccount` | No | No | PDA signer for treasury vault transfers. |
| `token_program` | `Interface<TokenInterface>` | No | No | SPL Token or Token-2022 program. |
| `system_program` | `Program<System>` | No | No | Solana system program. |

**Remaining Accounts:** For each transfer leg, provide 3 accounts:
1. **Mint account** — The SPL token mint.
2. **Source vault** — Treasury vault PDA.
3. **Destination ATA** — Beneficiary's token account.

**Access Control:** Operator wallet only. Instance must not be paused.

---

### settle_refund

Settles a ticket with a refund from the global liquidity vault. Used for insured ticket refunds. Closes the `ActiveEntry` account and creates a `SettlementReceipt`.

```rust
pub fn settle_refund(ctx: Context<SettleRefund>, args: SettleRefundArgs) -> Result<()>
```

**Parameters (SettleRefundArgs)**

| Name | Type | Description |
|------|------|-------------|
| `settlement_id` | `[u8; 32]` | Unique settlement identifier. |
| `instance_id` | `u64` | Game instance ID. |
| `ticket_id` | `u64` | Ticket ID to settle. |
| `beneficiary` | `Pubkey` | Must match the ticket owner. |
| `refund_mint` | `Pubkey` | Token mint for the refund. Must be in instance's `insurance_mints`. |
| `amount` | `u64` | Refund amount. Must be > 0. |
| `resolution_kind` | `ResolutionKind` | How the ticket was resolved. |
| `payload_hash` | `[u8; 32]` | Hash of the settlement payload. |

**Accounts**

| Name | Type | Mutable | Signer | Description |
|------|------|---------|--------|-------------|
| `operator` | `Signer` | Yes | Yes | Must be the operator wallet. |
| `factory_state` | `Account<FactoryState>` | No | No | The factory state PDA. |
| `instance` | `Account<GameInstance>` | Yes | No | The game instance. Must not be paused. |
| `ticket_record` | `Account<TicketRecord>` | Yes | No | The ticket to settle. Must be active. |
| `active_entry` | `Account<ActiveEntry>` | Yes | No | Closed upon settlement. |
| `settlement_receipt` | `Account<SettlementReceipt>` | Yes (init) | No | Idempotency receipt PDA. |
| `refund_mint` | `InterfaceAccount<Mint>` | No | No | The refund token mint. |
| `global_liquidity_vault` | `InterfaceAccount<TokenAccount>` | Yes | No | Source of refund funds. |
| `beneficiary_token_account` | `InterfaceAccount<TokenAccount>` | Yes | No | Beneficiary's token account. |
| `liquidity_authority` | `UncheckedAccount` | No | No | PDA signer for liquidity vault transfers. |
| `token_program` | `Interface<TokenInterface>` | No | No | SPL Token or Token-2022 program. |
| `system_program` | `Program<System>` | No | No | Solana system program. |

**Access Control:** Operator wallet only. Instance must not be paused.

**Errors:**
- `InvalidInsuranceMint` — Refund mint not in instance's insurance mints.
- `InsufficientVaultBalance` — Global liquidity vault has insufficient funds.
- `InvalidBeneficiary` — Beneficiary doesn't match ticket owner.

---

### settle_forfeit

Settles a ticket as forfeited. Transfers tokens from the treasury vault to designated wallets (not the ticket owner). Closes the `ActiveEntry` account and creates a `SettlementReceipt`.

```rust
pub fn settle_forfeit<'info>(
    ctx: Context<'_, '_, 'info, 'info, SettleForfeit<'info>>,
    args: SettleForfeitArgs,
) -> Result<()>
```

**Parameters (SettleForfeitArgs)**

| Name | Type | Description |
|------|------|-------------|
| `settlement_id` | `[u8; 32]` | Unique settlement identifier. |
| `instance_id` | `u64` | Game instance ID. |
| `ticket_id` | `u64` | Ticket ID to settle. |
| `legs` | `Vec<TransferLeg>` | Token transfer instructions. Destination is not validated against beneficiary. |
| `resolution_kind` | `ResolutionKind` | How the ticket was resolved. |
| `payload_hash` | `[u8; 32]` | Hash of the settlement payload. |

**Accounts**

| Name | Type | Mutable | Signer | Description |
|------|------|---------|--------|-------------|
| `operator` | `Signer` | Yes | Yes | Must be the operator wallet. |
| `factory_state` | `Account<FactoryState>` | No | No | The factory state PDA. |
| `instance` | `Account<GameInstance>` | Yes | No | The game instance. Must not be paused. |
| `ticket_record` | `Account<TicketRecord>` | Yes | No | The ticket to settle. Must be active. |
| `active_entry` | `Account<ActiveEntry>` | Yes | No | Closed upon settlement. |
| `settlement_receipt` | `Account<SettlementReceipt>` | Yes (init) | No | Idempotency receipt PDA. |
| `instance_authority` | `UncheckedAccount` | No | No | PDA signer for treasury vault transfers. |
| `token_program` | `Interface<TokenInterface>` | No | No | SPL Token or Token-2022 program. |
| `system_program` | `Program<System>` | No | No | Solana system program. |

**Remaining Accounts:** Same as `settle_payout` — for each leg: mint, source vault, destination ATA.

**Access Control:** Operator wallet only. Instance must not be paused.

---

### settle_users_batch

Batch settlement instruction that processes multiple tickets in a single transaction. Supports mixed settlement kinds (payout, refund, forfeit) within the same batch.

```rust
pub fn settle_users_batch<'info>(
    ctx: Context<'_, '_, 'info, 'info, SettleUsersBatch<'info>>,
    args: SettleUsersBatchArgs,
) -> Result<()>
```

**Parameters (SettleUsersBatchArgs)**

| Name | Type | Description |
|------|------|-------------|
| `instance_id` | `u64` | Game instance ID. |
| `items` | `Vec<BatchSettleItem>` | List of settlement items to process. Must not be empty. |

**BatchSettleItem**

| Name | Type | Description |
|------|------|-------------|
| `settlement_id` | `[u8; 32]` | Unique settlement identifier. Must be unique within the batch. |
| `ticket_id` | `u64` | Ticket ID to settle. |
| `kind` | `SettlementKind` | `Payout`, `Refund`, or `Forfeit`. |
| `beneficiary` | `Option<Pubkey>` | Required for Payout and Refund. Must match ticket owner. |
| `refund_mint` | `Option<Pubkey>` | Required for Refund. Must be in instance's `insurance_mints`. |
| `refund_amount` | `Option<u64>` | Required for Refund. Must be > 0. |
| `legs` | `Vec<TransferLeg>` | Transfer legs for Payout and Forfeit kinds. |
| `resolution_kind` | `ResolutionKind` | How the ticket was resolved. |
| `payload_hash` | `[u8; 32]` | Hash of the settlement payload. |

**Accounts**

| Name | Type | Mutable | Signer | Description |
|------|------|---------|--------|-------------|
| `operator` | `Signer` | Yes | Yes | Must be the operator wallet. |
| `factory_state` | `Account<FactoryState>` | No | No | The factory state PDA. |
| `instance` | `Account<GameInstance>` | Yes | No | The game instance. Must not be paused. |
| `instance_authority` | `UncheckedAccount` | No | No | PDA signer for treasury vault transfers. |
| `liquidity_authority` | `UncheckedAccount` | No | No | PDA signer for liquidity vault transfers. |
| `token_program` | `Interface<TokenInterface>` | No | No | SPL Token or Token-2022 program. |
| `system_program` | `Program<System>` | No | No | Solana system program. |

**Remaining Accounts:** For each item in order, provide:
1. **Ticket record** account
2. **Settlement receipt** account (uninitialized)
3. **Active entry** account
4. For Payout/Forfeit: per leg — mint, source vault, destination ATA
5. For Refund: refund mint, global liquidity vault, beneficiary ATA

**Access Control:** Operator wallet only. Instance must not be paused.

**Errors:**
- `DuplicateSettlement` — Duplicate `settlement_id` within the batch.
- `InvalidAmount` — Remaining accounts count doesn't match expected.

---

## Error Codes

| Error | Code | Description |
|-------|------|-------------|
| `Unauthorized` | 6000 | Caller is not the owner or admin. |
| `AdminAlreadyExists` | 6001 | Admin wallet already in the admin list. |
| `AdminNotFound` | 6002 | Admin wallet not found in the admin list. |
| `InstancePaused` | 6003 | Instance is currently paused. Settlements blocked. |
| `InstanceNotActive` | 6004 | Instance is not in the expected active/paused state. |
| `GameOver` | 6005 | Instance has been marked as game over. |
| `InvalidMint` | 6006 | Token mint is not in the accepted mints list or mismatches. |
| `InvalidAmount` | 6007 | Amount validation failed (zero, mismatch, or arithmetic). |
| `InvalidInsuranceMint` | 6008 | Mint is not eligible for insurance. |
| `InvalidTicketState` | 6009 | Ticket is not in the expected state for this operation. |
| `DuplicateSettlement` | 6010 | Settlement with this ID already exists. |
| `VaultMismatch` | 6011 | Vault PDA derivation or ownership mismatch. |
| `InsufficientVaultBalance` | 6012 | Vault doesn't have enough tokens for the transfer. |
| `InvalidBeneficiary` | 6013 | Beneficiary doesn't match the ticket owner. |
| `ImmutableConfig` | 6014 | Configuration limit reached (e.g., max admins). |
| `ArithmeticOverflow` | 6015 | Arithmetic operation would overflow. |
| `MissingOperatorCosigner` | 6016 | Operator co-signer is required but missing. |
| `InvalidOperatorCosigner` | 6017 | Provided operator wallet doesn't match factory config. |
| `InvalidEntryMode` | 6018 | Invalid entry mode value. |
| `InvalidPayerAuthority` | 6019 | Payer authority doesn't match expected for the entry mode. |
| `SponsoredInsuranceNotAllowed` | 6020 | Sponsored entries cannot have insurance. |
| `MaxInsuredTicketsReached` | 6021 | Instance has reached its insured ticket cap. |
| `ActiveTicketExists` | 6022 | User already has an active ticket in this game instance. |

---

## Access Control Summary

| Role | Instructions |
|------|-------------|
| **Owner** | `initialize_factory`, `add_admin`, `remove_admin`, `update_global_wallets` |
| **Owner or Admin** | `deploy_instance`, `freeze_instance`, `unfreeze_instance`, `init_global_liquidity_vault`, `init_treasury_vault` |
| **Operator Wallet** | `buy_ticket` (co-signer), `set_game_over`, `settle_payout`, `settle_refund`, `settle_forfeit`, `settle_users_batch` |
| **Master Wallet** | `topup_global_liquidity` |
