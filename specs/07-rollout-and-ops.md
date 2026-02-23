# 07 - Rollout and Operations

## Environments

1. Localnet: functional and adversarial tests.
2. Devnet: full backend integration and load rehearsal.
3. Mainnet: production deployment after sign-off checklist.

## Deployment Sequence

1. Deploy program.
2. Initialize `FactoryState`.
3. Configure global liquidity authority + USDT vault.
4. Deploy initial game instances.
5. Verify admin, master, operator roles.
6. Verify operator wallet co-signer validation path for `buy_ticket`.
7. Run smoke transactions:
   - buy standard
   - buy insured
   - topup global liquidity
   - payout settle
   - refund settle

## Pre-Mainnet Checklist

1. Security test suite complete.
2. Settlement idempotency validated under retry storms.
3. Vault address derivations frozen and documented.
4. Monitoring dashboards operational.
5. Incident runbooks approved by ops.

## Monitoring Requirements

1. Per-instance treasury balances by mint.
2. Global insurance USDT balance and trend.
3. Failed settlement rate by reason code.
4. Duplicate settlement attempts (security signal).
5. Pause duration and frequency metrics.
6. Entry co-signer rejection rate (`missing-cosigner`, `wrong-cosigner`, `not-signer`).

## Alert Threshold Recommendations

1. Global liquidity vault below configured runway threshold.
2. Settlement failure ratio > 2% over rolling 10 min.
3. Any unauthorized privileged-call attempt.
4. Unexpected high payout/refund volume spike.

## Incident Playbooks

## A) Freeze Incident

1. Trigger `freeze_instance`.
2. Rotate operator key if required.
3. Investigate failed/suspicious settlements.
4. Resume with `unfreeze_instance` after sign-off.

## B) Global Liquidity Underfunded

1. Pause affected instance(s) if needed.
2. Top up global liquidity vault from master wallet.
3. Resume settlements.
4. Backfill incident report and threshold adjustments.

## C) Operator Key Compromise

1. Freeze all active instances.
2. Update operator wallet.
3. Validate no unauthorized settlements/entries were executed.
4. Unfreeze and continue.

## Rollback Strategy

1. No destructive rollback of on-chain state.
2. Contain via freeze, key rotation, and controlled restart.
3. For program upgrade path, require governed upgrade authority process.
