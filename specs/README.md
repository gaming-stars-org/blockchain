# Gaming Stars Smart Contract Specification Pack

This folder contains the production-ready specification set for spec-driven development.

## Spec-Kit Workflow

Spec-kit scripts expect feature folders in the form `specs/###-feature-name/` with:

- `spec.md`
- `plan.md`
- `tasks.md`

Active sequence:

- `specs/001-gaming-stars-foundation/` (smart contracts first)
- `specs/002-backend-orchestration/` (backend second)
- `specs/003-frontend-app/` (frontend third)

See `specs/SEQUENCE.md` for execution order.

## Purpose

Define a decision-complete contract specification so implementation can proceed without product or architecture ambiguity.

## Locked Decisions

- Queue/referral computation is backend-owned.
- Smart contracts own custody, role enforcement, settlement execution, and audit events.
- Freeze policy blocks deposits and all settlement instructions.
- Mixed-token payout is executed in one settlement instruction with multiple transfer legs.
- Global liquidity vault token is USDT-only.
- Ticket entry is always backend co-signed by `operator_wallet`; public/open entry mode is not supported.
- Global wallets are shared across all instances: `dev_wallet`, `master_wallet`, `operator_wallet`.
- `operator_wallet` is the single backend key used for entry co-signing and settlement execution.
- `buy_ticket` supports `paid` and `sponsored` modes.
- Promo/free code lifecycle is backend-only (off-chain); contract does not store or validate code usage counters.
- In `sponsored` mode, payment is taken from operator-controlled sponsor funds; `insured` is not allowed in sponsored mode.
- Maximum insured deposits per instance is bounded by config:
  - backend enforces product policy pre-checks
  - contract enforces hard guard via instance-level counter + max limit
- Global USDT liquidity vault is shared across instances and is used for insured refunds and optional payout top-up legs.

## Spec Reading Order

1. `01-system-boundary.md`
2. `02-smart-contract-interface.md`
3. `03-state-model-and-pdas.md`
4. `04-settlement-and-money-flows.md`
5. `05-security-invariants.md`
6. `06-test-specification.md`
7. `07-rollout-and-ops.md`
8. `08-openapi-backend-contract.md`

## Definition of Done for Implementation Handoff

- Interfaces and account schemas are unambiguous.
- State transitions and invariants are testable.
- Backend payload contract is formalized.
- Release and incident procedures are documented.
