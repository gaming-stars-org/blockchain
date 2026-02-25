# TODO: 001 Smart Contracts Core

## Status

- [ ] Not started
- [x] In progress
- [ ] Done

## Phase 1 Setup

- [x] Scaffold `programs/gaming_stars/src/`
- [x] Create instruction/state module layout
- [x] Add `errors.rs` and `events.rs`
- [x] Create contract test folders

## Phase 2 Foundation

- [x] Implement PDA derivations
- [x] Implement account schemas
- [x] Implement auth guards (owner/master/operator)
- [x] Implement vault validation helpers
- [x] Implement state transition helpers

## Phase 3 Entry (P1)

- [x] Implement `initialize_factory`
- [x] Implement `update_global_wallets`
- [x] Implement `deploy_instance`
- [x] Implement `freeze_instance` / `unfreeze_instance`
- [x] Implement `buy_ticket` insured-cap guard (`max_insured_tickets` / `insured_tickets_count`)
- [x] Add happy/negative tests for entry and cosigner
- [x] Add insured-cap boundary and overflow negative tests

## Phase 4 Settlement (P2)

- [x] Implement `topup_global_liquidity`
- [x] Implement `settle_payout`
- [x] Implement `settle_refund`
- [x] Implement `settle_forfeit`
- [x] Implement `settle_users_batch`
- [x] Enforce multi-leg payout/forfeit execution via validated vault triplets
- [x] Execute real batch settlement items (payout/refund/forfeit) with receipt creation
- [x] Add replay/beneficiary/vault negative tests

## Phase 5 Ops Safety (P3)

- [x] Implement `set_game_over`
- [x] Add pause matrix tests
- [x] Add game-over behavior tests
- [x] Add operator-rotation auth tests

## Release Gate for 002

- [ ] Smart-contract interface frozen
- [ ] Error/event catalog frozen
- [ ] Localnet test matrix green
- [ ] Devnet smoke green
- [ ] `contracts/onchain-instructions.md` finalized
