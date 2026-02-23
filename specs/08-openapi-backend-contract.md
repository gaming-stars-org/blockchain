# 08 - Backend Contract (Entry + Settlement API)

This file defines canonical backend payload contracts consumed by smart contract entry and settlement instructions.

## API Style

Backend can be REST, gRPC, or job-driven internally. Payload shape below is canonical regardless of transport.

## Deterministic `settlement_id`

- Type: 32-byte hash
- Recommended derivation:
  - `sha256(instance_id | ticket_id | settlement_kind | payload_canonical_json | monotonic_nonce)`
- Must be unique globally.

## `payload_hash` Convention

- Backend may include `payload_hash` in API payloads for its own audit/indexing.
- Smart contract does not take `payload_hash` as an instruction arg.
- Program derives and stores canonical on-chain `SettlementReceipt.payload_hash`.

## Canonical Payloads

## Entry Request (`buy_ticket`)

```json
{
  "instance_id": 42,
  "user": "Pubkey",
  "entry_mode": "paid",
  "entry_mint": "USDC_MINT",
  "insured": true,
  "entry_total_amount": "11000000",
  "insurance_premium_amount_usdt": "1000000",
  "payer_authority": "Pubkey",
  "payer_entry_token_account": "Pubkey",
  "external_ref": "0x...optional32bytes"
}
```

Rules:

1. Entry is always backend-controlled and requires transaction co-sign by global `operator_wallet`.
2. Contract verifies `operator_wallet` account equals `FactoryState.operator_wallet` and is signer.
3. User account must also be signer.
4. There is no open/public entry path.
5. `entry_mode=paid`:
   - `payer_authority == user`
6. `entry_mode=sponsored`:
   - `payer_authority == operator_wallet`
   - `insured == false`

## Payout Request

```json
{
  "settlement_id": "0x...32bytes",
  "instance_id": 42,
  "ticket_id": 100120,
  "kind": "payout",
  "beneficiary": "Pubkey",
  "resolution_kind": "organic",
  "legs": [
    {
      "mint": "USDT_MINT",
      "amount": "10000000",
      "source_vault": "Pubkey",
      "destination_ata": "Pubkey"
    },
    {
      "mint": "USDC_MINT",
      "amount": "10000000",
      "source_vault": "Pubkey",
      "destination_ata": "Pubkey"
    }
  ],
  "payload_hash": "0x...32bytes"
}
```

## Refund Request

```json
{
  "settlement_id": "0x...32bytes",
  "instance_id": 42,
  "ticket_id": 100121,
  "kind": "refund",
  "beneficiary": "Pubkey",
  "mint": "USDT_MINT",
  "amount": "10000000",
  "source_vault": "GLOBAL_LIQUIDITY_USDT_VAULT",
  "payload_hash": "0x...32bytes"
}
```

## Forfeit Request

```json
{
  "settlement_id": "0x...32bytes",
  "instance_id": 42,
  "ticket_id": 100122,
  "kind": "forfeit",
  "resolution_kind": "expiry",
  "legs": [
    {
      "mint": "USDC_MINT",
      "amount": "10000000",
      "source_vault": "INSTANCE_USDC_VAULT",
      "destination_ata": "DEV_USDC_ATA"
    }
  ],
  "payload_hash": "0x...32bytes"
}
```

## Pre-submit Backend Validation

### For entry

1. User is eligible for entry by backend policy.
2. Operator key used for co-sign is current `FactoryState.operator_wallet`.
3. Amounts satisfy contract configuration.
4. Correct user token accounts are provided for selected mint and insurance path.
5. Entry mode and payer mapping is valid (`paid=user`, `sponsored=operator`).
6. Promo/free code lifecycle is validated off-chain (valid, not used, not expired) before building sponsored entry tx.

### For settlements

1. Ticket exists and is `active` in backend projection.
2. Ticket instance matches payload instance.
3. Beneficiary equals on-chain `ticket.owner` for payout/refund payloads.
4. Beneficiary address and ATAs are consistent with mint.
5. Source vault addresses match canonical PDA derivation.
6. Amounts are positive and sum rules match product logic.
7. `settlement_id` not previously emitted by backend.

## Retry and Idempotency Contract

1. Backend may retry identical settlement payload on network timeout.
2. Backend must never mutate payload with same `settlement_id`.
3. Contract-side duplicate receipts are treated as idempotent rejection.
4. Backend should mark settlement final on first confirmed success event.

## Suggested Transport Endpoints (Reference)

```yaml
POST /v1/entries/submit
POST /v1/settlements/payout
POST /v1/settlements/refund
POST /v1/settlements/forfeit
POST /v1/instances/{id}/freeze
POST /v1/instances/{id}/unfreeze
POST /v1/liquidity/topup
```

## Response Contract (Reference)

```json
{
  "status": "submitted",
  "tx_signature": "...",
  "settlement_id": "0x...",
  "submitted_at": "2026-02-20T12:00:00Z"
}
```

## Error Mapping

Backend should map on-chain error codes directly for observability:

- `DuplicateSettlement`
- `Unauthorized`
- `InvalidTicketState`
- `VaultMismatch`
- `InvalidMint`
- `InsufficientVaultBalance`
- `MissingOperatorCosigner`
- `InvalidOperatorCosigner`
- `InvalidEntryMode`
- `InvalidPayerAuthority`
- `SponsoredInsuranceNotAllowed`
