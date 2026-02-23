# 05 - Security Invariants

## Core Invariants

1. Principal custody invariant:
   - Principal cannot leave treasury vaults except through `settle_payout` or `settle_forfeit`.
2. Insurance custody invariant:
   - Insured refunds are paid from global USDT liquidity vault.
   - Global liquidity vault may also be used as USDT top-up source for payout legs.
3. Co-signed entry invariant:
   - `buy_ticket` requires global `operator_wallet` co-signer and user signer.
4. Entry mode invariant:
   - `paid` entries are user-funded.
   - `sponsored` entries are operator-funded.
   - `sponsored` entries cannot be insured.
5. Authorization invariant:
   - Only owner can deploy/freeze/unfreeze/update global wallets.
   - Only master wallet can top up global liquidity vault.
   - Only global operator wallet can co-sign entry, execute settlements, and set game over.
6. Replay invariant:
   - Every settlement id is consumed exactly once.
7. State transition invariant:
   - Ticket terminal statuses are immutable.
8. Pause invariant:
   - When paused, `buy_ticket`, `settle_payout`, `settle_refund`, `settle_forfeit`, `settle_users_batch` all fail.
9. Mint-account consistency invariant:
   - Each transfer source/destination must match mint and expected owner.
10. No hidden admin drain invariant:
   - There is no instruction that lets admin withdraw principal directly from treasury.

## Threat Model

| Threat | Impact | Mitigation | Detection |
|---|---|---|---|
| User runs custom entry script | bypass app rules / queue poisoning | mandatory operator co-sign check on `buy_ticket` | entry cosigner failure metrics and rejected tx logs |
| Operator submits duplicate settlement | Double payout/refund | `SettlementReceipt` PDA by `settlement_id` | Duplicate settlement errors + alerts |
| Wrong vault account passed in settlement | Fund misdirection attempt | strict vault derivation checks by instance+mint | Settlement validation failure metrics |
| Compromised operator key | Unauthorized settlements | key rotation instruction + freeze emergency | abnormal settlement rate alert |
| Compromised admin key | Freeze abuse / wallet changes | multisig owner policy recommended off-chain | admin action audit stream |
| Underfunded global liquidity vault | refund/payout top-up failure | solvency monitoring and top-up policy | vault coverage dashboard alerts |
| Invalid beneficiary ATA | payout/refund goes to wrong account | ATA owner and mint checks | failed tx telemetry |
| Arithmetic overflow | incorrect balances | checked math only | test coverage + runtime errors |

## Mandatory Security Controls

1. Verify signer role in every privileged instruction.
2. Verify ticket-instance relationship in every settlement.
3. Verify payout/refund beneficiary equals `ticket.owner`.
4. Verify settlement payload hash in receipt for tamper evidence.
5. Enforce operator co-signer checks in `buy_ticket`.
6. Enforce entry-mode payer checks in `buy_ticket`.
7. Enforce exact amount checks in `buy_ticket`.
8. Enforce insurance refund mint as USDT only.

## Security Audit Checklist (Pre-Mainnet)

1. Access control coverage complete.
2. Replay protection coverage complete.
3. Vault derivation checks complete.
4. Pause behavior tested for all blocked instructions.
5. State transition matrix tested exhaustively.
6. Event integrity reviewed for forensic traceability.
