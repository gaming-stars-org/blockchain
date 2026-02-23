# 04 - Settlement and Money Flows

## Deposit Flow (`buy_ticket`)

1. Validate `instance.status == active`.
2. Validate `entry_mint` is in `accepted_mints`.
3. Validate transaction includes global `operator_wallet` signer from `factory_state`.
4. Validate `operator_wallet.is_signer == true`.
5. Validate `entry_total_amount == ticket_price + entry_fee`.
6. Validate entry mode:
   - `paid`: payer authority must be `user`
   - `sponsored`: payer authority must be `operator_wallet`
7. Require insurance amount:
   - insured: `insurance_premium_amount_usdt == insurance_premium`
   - not insured: `insurance_premium_amount_usdt == 0`
8. Sponsored guard:
   - if `entry_mode == sponsored`, then `insured` must be false.
9. Transfer split atomically:
   - `entry_fee` from payer -> ATA owned by `factory_state.dev_wallet` for `entry_mint`
   - `ticket_price` from payer -> `treasury_vault(instance,mint)`
   - if paid+insured: `insurance_premium` from user USDT ATA -> `global_liquidity_vault_usdt`
10. Create `TicketRecord(status=active)` with `entry_mode` and `paid_by`.
11. Increment `next_ticket_id` and update `last_activity_ts`.
12. Emit `TicketPurchased`.

## Payout Flow (`settle_payout`)

1. Validate `instance.status == active`.
2. Validate signer is global `factory_state.operator_wallet`.
3. Validate `ticket.status == active`.
4. Validate `settlement_receipt` PDA does not exist.
5. Validate each transfer leg:
   - `mint` is accepted by instance
   - for non-USDT: `source_vault` matches treasury vault for `(instance,mint)`
   - for USDT: `source_vault` can be treasury vault or global liquidity vault
   - destination ATA belongs to beneficiary
   - amount > 0 and vault balance is sufficient
6. Validate `beneficiary == ticket.owner`.
7. Create `SettlementReceipt(kind=payout)`.
8. Execute all transfer legs from allowed source vaults to beneficiary ATAs.
9. Update `ticket.status=paid`, `resolved_at`, `resolution_kind`.
10. Emit `PayoutSettled` with leg breakdown.

## Refund Flow (`settle_refund`)

1. Validate signer is global `factory_state.operator_wallet`.
2. Validate instance is not paused.
3. Validate `ticket.status == active` and `ticket.insured == true`.
4. Validate `settlement_receipt` non-existence.
5. Validate `beneficiary == ticket.owner`.
6. Validate refund mint is USDT and source is global liquidity vault.
7. Validate global liquidity vault balance >= `amount_usdt`.
8. Create `SettlementReceipt(kind=refund)`.
9. Transfer USDT from global liquidity vault to beneficiary USDT ATA.
10. Update `ticket.status=refunded`, `resolved_at`, `resolution_kind`.
11. Emit `RefundSettled`.

## Forfeit Flow (`settle_forfeit`)

1. Validate signer is global `factory_state.operator_wallet`.
2. Validate instance is not paused.
3. Validate `ticket.status == active` and `ticket.insured == false`.
4. Validate unique `settlement_id`.
5. Validate each leg maps to valid treasury vault and dev wallet ATA.
6. Create `SettlementReceipt(kind=forfeit)`.
7. Transfer forfeited principal legs from treasury vaults to dev wallet.
8. Update `ticket.status=forfeited`, `resolved_at`, `resolution_kind`.
9. Emit `ForfeitSettled`.

## Batch Settlement (`settle_users_batch`)

- Input: `items: Vec<BatchSettleItem>` with explicit kind-specific payload fields.
- Every item uses the same validation rules as single-item settlement instructions.
- `beneficiary` is mandatory for payout/refund items and must equal `ticket.owner`.
- Duplicate `settlement_id` within batch or on-chain history fails the transaction.
- Default behavior: one invalid item fails the whole transaction (atomic).
- Backend should split large batches into multiple transactions by compute limits.

## Pause-Aware Timer Semantics

Contract stores:

- `pause_started_at`
- `cumulative_paused_secs`

Effective time function:

- if active:
  - `effective_now = now - cumulative_paused_secs`
- if paused:
  - `effective_now = pause_started_at - cumulative_paused_secs`

Timer checks in backend should use effective time semantics to avoid drift with contract state.

## Game Over

- `set_game_over` transitions instance status to `game_over`.
- While `game_over`:
  - `buy_ticket` must fail.
  - settlement instructions remain allowed (if not paused) for cleanup.

## Idempotency and Replay Protection

- `settlement_id` is backend-generated deterministic id.
- `SettlementReceipt` PDA creation guarantees at-most-once settlement execution.
- Duplicate calls with same `settlement_id` must fail before any transfer.

## Failure Behavior

All money-moving instructions are fully atomic. If any validation or transfer fails, state and balances remain unchanged.

For `buy_ticket`, missing/invalid operator co-signer must fail before any transfer is executed.
For `buy_ticket`, invalid sponsored mode or sponsored+insured combination must fail before any transfer is executed.
