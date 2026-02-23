# 06 - Test Specification

## Test Strategy

- Unit tests per instruction.
- Stateful integration tests over full flows.
- Negative and adversarial scenarios.
- Deterministic assertions for balances, statuses, and events.

## Instruction Test Matrix

| Instruction | Happy Path | Auth Fail | Validation Fail | State Fail | Balance Fail | Replay Fail |
|---|---|---|---|---|---|---|
| `initialize_factory` | yes | yes | yes | n/a | n/a | n/a |
| `update_global_wallets` | yes | yes | yes | n/a | n/a | n/a |
| `deploy_instance` | yes | yes | yes | n/a | n/a | n/a |
| `freeze_instance` | yes | yes | n/a | yes | n/a | n/a |
| `unfreeze_instance` | yes | yes | n/a | yes | n/a | n/a |
| `buy_ticket` | yes | yes | yes | yes | yes | yes |
| `topup_global_liquidity` | yes | yes | yes | yes | yes | n/a |
| `settle_payout` | yes | yes | yes | yes | yes | yes |
| `settle_refund` | yes | yes | yes | yes | yes | yes |
| `settle_forfeit` | yes | yes | yes | yes | yes | yes |
| `set_game_over` | yes | yes | n/a | yes | n/a | n/a |
| `settle_users_batch` | yes | yes | yes | yes | yes | yes |

## Critical Scenarios

1. Duplicate `settlement_id` in same block and later block both fail second time.
2. Mixed payout with 2+ legs succeeds and sums expected payout.
3. Settlement with wrong vault or wrong mint account fails.
4. Settlement where `beneficiary != ticket.owner` fails.
5. Insured ticket refund from non-USDT source fails.
6. Uninsured ticket refund attempt fails.
7. Pause blocks every money-moving instruction.
8. Game-over blocks `buy_ticket` but allows settlement cleanup.
9. Terminal ticket status cannot be overwritten by subsequent settlement.
10. `buy_ticket` without operator co-signer fails.
11. `buy_ticket` with wrong operator key fails.
12. `buy_ticket` where operator account is present but not signer fails.
13. `buy_ticket(entry_mode=sponsored)` succeeds with operator-funded payer account.
14. `buy_ticket(entry_mode=sponsored, insured=true)` fails.
15. `buy_ticket(entry_mode=sponsored)` with payer authority != operator fails.
16. `set_game_over` by non-operator fails.

## Economic Integrity Tests

1. Standard entry exact amount accepted.
2. Standard entry overpay/underpay rejected.
3. Insured entry exact amount accepted.
4. Dev fee and principal split exactly match configured values.
5. Insurance premium route hits global USDT liquidity vault only.
6. Insured USDC entry requires additional USDT premium transfer and fails without it.
7. Sponsored entry moves principal+fee from sponsor payer account (not user account).

## Timer/State Tests

1. Pause/unpause updates cumulative paused duration correctly.
2. Effective-time calculations are deterministic relative to stored pause metadata.
3. Tickets and instance statuses transition only through allowed matrix.

## Event Assertions

For each successful instruction assert:

1. Correct event type.
2. Correct keys (`instance_id`, `ticket_id`, `settlement_id`).
3. Correct amount(s), mint(s), actor.

## Release Acceptance Criteria

1. 100% pass for all required scenarios.
2. No flaky tests under repeated runs.
3. Coverage on all privileged instruction branches.
4. Integration run succeeds on localnet and devnet.
