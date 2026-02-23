# 02 - Smart Contract Interface

## Instruction Set

## 1) `initialize_factory`

Initializes global configuration and role wallets shared by all instances.

- Signer: `owner`
- Args:
  - `owner: Pubkey`
  - `dev_wallet: Pubkey`
  - `master_wallet: Pubkey`
  - `operator_wallet: Pubkey`
- Accounts:
  - `factory_state` (init PDA)
  - system program

## 2) `update_global_wallets`

Updates global wallet roles.

- Signer: `owner`
- Args:
  - `new_dev_wallet: Option<Pubkey>`
  - `new_master_wallet: Option<Pubkey>`
  - `new_operator_wallet: Option<Pubkey>`
- Accounts:
  - `factory_state` (mut)

## 3) `deploy_instance`

Creates a new `GameInstance` and required treasury vault accounts.

- Signer: `owner`
- Args:
  - `instance_id: u64`
  - `ticket_price: u64`
  - `entry_fee: u64`
  - `insurance_premium: u64`
  - `payout_ratio_num: u16` (default 2)
  - `payout_ratio_den: u16` (default 1)
  - `game_duration_secs: i64`
  - `user_ttl_secs: i64`
  - `accepted_mints: Vec<Pubkey>` (USDT/USDC, one or both)
- Accounts:
  - `factory_state` (mut)
  - `game_instance` (init PDA)
  - `instance_authority_pda`
  - treasury token accounts for each accepted mint (init)
  - system + token programs

## 4) `freeze_instance`

Freezes instance operations.

- Signer: `owner`
- Args: `instance_id: u64`
- Accounts: `factory_state`, `game_instance` (mut)

## 5) `unfreeze_instance`

Unfreezes and accounts for elapsed pause duration.

- Signer: `owner`
- Args: `instance_id: u64`
- Accounts: `factory_state`, `game_instance` (mut)

## 6) `buy_ticket`

User deposit entry with immediate fund split. Always backend co-signed.

- Signer: `user` and `operator_wallet` (must equal `factory_state.operator_wallet`)
- Args:
  - `instance_id: u64`
  - `entry_mode: EntryMode` (`paid` | `sponsored`)
  - `entry_mint: Pubkey`
  - `insured: bool`
  - `entry_total_amount: u64` (`ticket_price + entry_fee`)
  - `insurance_premium_amount_usdt: u64` (must equal configured premium when insured, else 0)
  - `external_ref: Option<[u8; 32]>` (opaque backend correlation key)
- Accounts:
  - `factory_state`
  - `game_instance` (mut)
  - `ticket_record` (init PDA)
  - `operator_wallet` (signer)
  - `payer_entry_token_account` (mut)
  - `payer_authority` (signer; `user` for paid, `operator_wallet` for sponsored)
  - `user_usdt_token_account` (mut; required when `entry_mode=paid` and `insured=true` and entry mint != USDT)
  - `treasury_vault_for_mint` (mut)
  - `dev_wallet_token_account_for_mint` (mut, must match `factory_state.dev_wallet`)
  - `global_liquidity_vault_usdt` (mut, required when `entry_mode=paid` and `insured=true`)
  - token/system programs

Entry mode validation rules:

1. `entry_mode=paid`:
   - `payer_authority == user`
   - `payer_entry_token_account` belongs to `user`
   - `insured` allowed (`true/false`)
2. `entry_mode=sponsored`:
   - `payer_authority == operator_wallet`
   - `payer_entry_token_account` belongs to `operator_wallet` (or operator-controlled sponsor wallet if explicitly configured)
   - `insured` must be `false`
   - `insurance_premium_amount_usdt` must be `0`

## 7) `topup_global_liquidity`

Transfers USDT from master wallet to global liquidity vault.

- Signer: `master_wallet` (must equal `factory_state.master_wallet`)
- Args:
  - `amount_usdt: u64`
- Accounts:
  - `factory_state`
  - `master_wallet_usdt_ata` (mut)
  - `global_liquidity_vault_usdt` (mut)

## 8) `settle_payout`

Executes a payout in one call with one or more transfer legs.

- Signer: `operator_wallet` (must equal `factory_state.operator_wallet`)
- Args:
  - `settlement_id: [u8; 32]`
  - `instance_id: u64`
  - `ticket_id: u64`
  - `beneficiary: Pubkey`
  - `legs: Vec<TransferLeg>`
  - `resolution_kind: ResolutionKind` (`organic` or `referral`)
- `TransferLeg`:
  - `mint: Pubkey`
  - `amount: u64`
  - `source_vault: Pubkey` (treasury vault for mint, or global liquidity vault for USDT top-up leg)
  - `beneficiary_ata: Pubkey`
- Accounts:
  - `factory_state`
  - `game_instance` (mut)
  - `ticket_record` (mut)
  - `settlement_receipt` (init PDA)
  - listed vault and beneficiary token accounts (mut)
  - token program

Validation requirements:

1. `beneficiary` must equal `ticket_record.owner`.
2. For USDT legs only, `source_vault` may be either treasury vault or global liquidity vault.
3. For non-USDT legs, `source_vault` must be treasury vault for `(instance,mint)`.

## 9) `settle_refund`

Executes insured refund from global USDT liquidity vault.

- Signer: `operator_wallet` (must equal `factory_state.operator_wallet`)
- Args:
  - `settlement_id: [u8; 32]`
  - `instance_id: u64`
  - `ticket_id: u64`
  - `beneficiary: Pubkey`
  - `amount_usdt: u64`
- Accounts:
  - `factory_state`
  - `game_instance` (mut)
  - `ticket_record` (mut)
  - `settlement_receipt` (init PDA)
  - `global_liquidity_vault_usdt` (mut)
  - `beneficiary_usdt_ata` (mut)
  - token program

Validation requirements:

1. `beneficiary` must equal `ticket_record.owner`.
2. Refund source must be `global_liquidity_vault_usdt` only.

## 10) `settle_forfeit`

Routes unresolved uninsured principal from treasury to dev wallet.

- Signer: `operator_wallet` (must equal `factory_state.operator_wallet`)
- Args:
  - `settlement_id: [u8; 32]`
  - `instance_id: u64`
  - `ticket_id: u64`
  - `legs: Vec<DevTransferLeg>`
  - `resolution_kind: ResolutionKind` (`expiry` or `game_over`)
- `DevTransferLeg`:
  - `mint: Pubkey`
  - `amount: u64`
  - `source_vault: Pubkey`
  - `dev_wallet_ata: Pubkey`
- Accounts:
  - `factory_state`
  - `game_instance` (mut)
  - `ticket_record` (mut)
  - `settlement_receipt` (init PDA)
  - vault and dev token accounts (mut)

## 11) `set_game_over`

Locks an instance for no-new-deposits state.

- Signer: `operator_wallet` (must equal `factory_state.operator_wallet`)
- Args: `instance_id: u64`
- Accounts: `factory_state`, `game_instance` (mut)

## 12) `settle_users_batch`

Optional batch convenience path for expiry/game-over settlements.

- Signer: `operator_wallet` (must equal `factory_state.operator_wallet`)
- Args:
  - `instance_id: u64`
  - `items: Vec<BatchSettleItem>`
- Behavior: atomic by default (one invalid item reverts whole tx) unless explicitly split client-side.

`BatchSettleItem`:

- `kind: SettlementKind` (`payout` | `refund` | `forfeit`)
- `settlement_id: [u8; 32]`
- `ticket_id: u64`
- `beneficiary: Option<Pubkey>` (`required` for payout/refund; `none` for forfeit)
- `resolution_kind: Option<ResolutionKind>`
- `payout_legs: Option<Vec<TransferLeg>>`
- `refund_amount_usdt: Option<u64>`
- `forfeit_legs: Option<Vec<DevTransferLeg>>`

Batch validation rules:

1. Every item runs the same validations as its single-settlement instruction.
2. `beneficiary` must equal `ticket_record.owner` for payout/refund items.
3. Payout legs may use treasury vaults for accepted mints; global liquidity vault is allowed only for USDT legs.
4. Duplicate `settlement_id` within batch or on-chain history must fail.

## Settlement Receipt Payload Hash Policy

- `payload_hash` is stored in `SettlementReceipt` for tamper evidence.
- It is program-derived from normalized instruction data and relevant account keys.
- It is not a separate instruction argument.
- Off-chain backend hash can differ in construction, but on-chain receipt hash is the authoritative audit value.

## Co-Signer Validation Requirements

`buy_ticket` must fail unless all are true:

1. Transaction includes `operator_wallet` signer account.
2. `operator_wallet.key == factory_state.operator_wallet`.
3. `operator_wallet.is_signer == true`.
4. `user.is_signer == true`.
5. `entry_mode` payer authority checks are enforced (`paid -> user`, `sponsored -> operator`).

## Event Catalog

- `FactoryInitialized`
- `GlobalWalletsUpdated`
- `InstanceDeployed`
- `InstanceFrozen`
- `InstanceUnfrozen`
- `TicketPurchased`
- `LiquidityToppedUp`
- `PayoutSettled`
- `RefundSettled`
- `ForfeitSettled`
- `GameOverSet`

Each event includes: `instance_id` (where applicable), `actor`, `timestamp`, plus instruction-specific fields.

## Error Codes (Canonical)

- `Unauthorized`
- `InstancePaused`
- `InstanceNotActive`
- `GameOver`
- `InvalidMint`
- `InvalidAmount`
- `InvalidInsuranceMint`
- `InvalidTicketState`
- `DuplicateSettlement`
- `VaultMismatch`
- `InsufficientVaultBalance`
- `InvalidBeneficiary`
- `ImmutableConfig`
- `ArithmeticOverflow`
- `MissingOperatorCosigner`
- `InvalidOperatorCosigner`
- `InvalidEntryMode`
- `InvalidPayerAuthority`
- `SponsoredInsuranceNotAllowed`
