# TODO: 001 Smart Contracts Core

## Status

- [ ] Not started
- [ ] In progress
- [ ] Done

## Phase 1 Setup

- [ ] Scaffold `programs/gaming_stars/src/`
- [ ] Create instruction/state module layout
- [ ] Add `errors.rs` and `events.rs`
- [ ] Create contract test folders

## Phase 2 Foundation

- [ ] Implement PDA derivations
- [ ] Implement account schemas
- [ ] Implement auth guards (owner/master/operator)
- [ ] Implement vault validation helpers
- [ ] Implement state transition helpers

## Phase 3 Entry (P1)

- [ ] Implement `initialize_factory`
- [ ] Implement `update_global_wallets`
- [ ] Implement `deploy_instance`
- [ ] Implement `freeze_instance` / `unfreeze_instance`
- [ ] Implement `buy_ticket` insured-cap guard (`max_insured_tickets` / `insured_tickets_count`)
- [ ] Add happy/negative tests for entry and cosigner
- [ ] Add insured-cap boundary and overflow negative tests

## Phase 4 Settlement (P2)

- [ ] Implement `topup_global_liquidity`
- [ ] Implement `settle_payout`
- [ ] Implement `settle_refund`
- [ ] Implement `settle_forfeit`
- [ ] Implement `settle_users_batch`
- [ ] Add replay/beneficiary/vault negative tests

## Phase 5 Ops Safety (P3)

- [ ] Implement `set_game_over`
- [ ] Add pause matrix tests
- [ ] Add game-over behavior tests
- [ ] Add operator-rotation auth tests

## Release Gate for 002

- [ ] Smart-contract interface frozen
- [ ] Error/event catalog frozen
- [ ] Localnet test matrix green
- [ ] Devnet smoke green
- [ ] `contracts/onchain-instructions.md` finalized
