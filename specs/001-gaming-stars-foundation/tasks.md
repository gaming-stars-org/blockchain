# Tasks: Gaming Stars Smart Contracts Core

**Input**: `/specs/001-gaming-stars-foundation/`  
**Prerequisites**: `spec.md`, `plan.md`, `data-model.md`, `contracts/`

## Phase 1: Setup

- [ ] T001 Create contract module skeleton in `programs/gaming_stars/src/`
- [ ] T002 Create instruction module tree in `programs/gaming_stars/src/instructions/`
- [ ] T003 [P] Create state module tree in `programs/gaming_stars/src/state/`
- [ ] T004 [P] Create `errors.rs` and `events.rs`
- [ ] T005 [P] Create contract test layout in `tests/contract/`, `tests/integration/`, `tests/adversarial/`

## Phase 2: Foundation

- [ ] T006 Implement PDA derivation helpers in `programs/gaming_stars/src/state/pda.rs`
- [ ] T007 Implement account schemas in `programs/gaming_stars/src/state/accounts.rs`
- [ ] T008 Implement shared auth guards in `programs/gaming_stars/src/instructions/guards.rs`
- [ ] T009 [P] Implement vault validation helpers in `programs/gaming_stars/src/instructions/vaults.rs`
- [ ] T010 [P] Implement state transition helpers in `programs/gaming_stars/src/state/transitions.rs`
- [ ] T011 Implement canonical errors in `programs/gaming_stars/src/errors.rs`
- [ ] T012 Implement event catalog in `programs/gaming_stars/src/events.rs`

## Phase 3: US1 Controlled Entry (P1)

- [ ] T013 [P] Add factory and instance auth tests in `tests/contract/factory-instance.spec.ts`
- [ ] T014 [P] Add `buy_ticket` paid and sponsored happy-path tests in `tests/contract/buy-ticket.spec.ts`
- [ ] T015 [P] Add operator cosigner negative tests in `tests/adversarial/buy-ticket-cosigner.spec.ts`
- [ ] T016 [P] Add sponsored+insured and payer-authority negative tests in `tests/adversarial/buy-ticket-sponsored.spec.ts`
- [ ] T017 Implement `initialize_factory`
- [ ] T018 Implement `update_global_wallets`
- [ ] T019 Implement `deploy_instance`
- [ ] T020 Implement `freeze_instance` + `unfreeze_instance`
- [ ] T021 Implement `buy_ticket`

## Phase 4: US2 Settlement and Replay (P2)

- [ ] T022 [P] Add `settle_payout` tests in `tests/contract/settle-payout.spec.ts`
- [ ] T023 [P] Add `settle_refund` tests in `tests/contract/settle-refund.spec.ts`
- [ ] T024 [P] Add `settle_forfeit` tests in `tests/contract/settle-forfeit.spec.ts`
- [ ] T025 [P] Add replay and beneficiary mismatch negatives in `tests/adversarial/replay-beneficiary.spec.ts`
- [ ] T026 [P] Add batch parity tests in `tests/integration/settle-batch.spec.ts`
- [ ] T027 Implement `topup_global_liquidity`
- [ ] T028 Implement `settle_payout`
- [ ] T029 Implement `settle_refund`
- [ ] T030 Implement `settle_forfeit`
- [ ] T031 Implement `settle_users_batch`

## Phase 5: US3 Operational Safety (P3)

- [ ] T032 [P] Add pause matrix tests in `tests/integration/pause-matrix.spec.ts`
- [ ] T033 [P] Add game-over behavior tests in `tests/integration/game-over.spec.ts`
- [ ] T034 [P] Add operator rotation regression tests in `tests/adversarial/operator-rotation.spec.ts`
- [ ] T035 Implement `set_game_over`

## Phase 6: Finalization

- [ ] T036 Run full localnet suite and record results in `specs/001-gaming-stars-foundation/quickstart.md`
- [ ] T037 Run devnet suite and record results in `specs/001-gaming-stars-foundation/quickstart.md`
- [ ] T038 Final docs consistency check against `contracts/onchain-instructions.md`

## Execution Order

1. Phase 1 -> 2 -> 3.
2. Ship P1 on-chain MVP.
3. Then complete P2, P3.
4. After `001` signoff, start `002` backend and then `003` frontend.
