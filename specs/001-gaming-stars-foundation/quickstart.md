# Quickstart: Gaming Stars Foundation

## Purpose

Run a deterministic smoke path for entry, settlement, security, and ops controls.

## Pre-requisites

- Solana local validator or devnet access
- Deployed program ID
- Funded wallets for owner, master, operator, and test users
- USDT and optional USDC mints configured for test environment

## Flow

1. Initialize factory with owner/dev/master/operator wallets.
2. Deploy one instance with config:
   - `ticket_price`
   - `entry_fee`
   - `insurance_premium`
   - `max_insured_tickets`
   - accepted mints (`USDT`, `USDC` as needed)
3. Top up global liquidity vault from master wallet.
4. Execute paid ticket entry (insured=false).
5. Execute paid ticket entry (insured=true).
6. Execute sponsored ticket entry (insured=false).
7. Settle one payout with multi-leg transfer.
8. Settle one insured refund from global liquidity vault (`USDT` or `USDC` based on refund mint).
9. Settle one uninsured forfeit to dev wallet ATA.
10. Retry a previous settlement ID and confirm rejection.
11. Freeze instance and confirm blocked money-moving instructions.
12. Unfreeze and confirm operations resume.
13. Set game over and confirm buy is blocked but settlement cleanup works.
14. Fill insured entries until `max_insured_tickets` is reached, then verify next insured entry fails while non-insured entry still succeeds.

## Expected Results

- All successful transactions emit matching events.
- All forbidden paths fail before any token movement.
- No duplicate settlement can execute.
- Ticket terminal states are immutable after resolution.

## Smoke Exit Criteria

- Critical scenarios in `06-test-specification.md` pass.
- Metrics and logs capture signer failures and duplicate settlement attempts.
- Runbook actions (freeze, rotation, top-up) are executable by designated roles only.
