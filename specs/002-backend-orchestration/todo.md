# TODO: 002 Backend Orchestration

## Dependency Gate

- [ ] 001 is frozen and signed off

## Phase 1 Setup

- [ ] Scaffold `backend/src/` and `backend/tests/`
- [ ] Add OpenAPI-first routing structure
- [ ] Add DB migration for idempotency

## Phase 2 Core Services

- [ ] Implement deterministic `settlement_id` generator
- [ ] Implement pre-submit validators
- [ ] Implement insured-cap pre-check via on-chain `GameInstance` counters
- [ ] Implement idempotency store and conflict behavior
- [ ] Implement chain submit + confirmation service
- [ ] Implement on-chain error mapper

## Phase 3 API Endpoints

- [ ] Implement `/v1/entries/submit`
- [ ] Implement `/v1/settlements/payout`
- [ ] Implement `/v1/settlements/refund`
- [ ] Implement `/v1/settlements/forfeit`

## Phase 4 Observability

- [ ] Add metrics (fail ratio, duplicate attempts, cosigner failures)
- [ ] Add insured-cap rejection metric and alert
- [ ] Add structured logs with correlation keys
- [ ] Add alerts and runbook links

## Release Gate for 003

- [ ] API contract frozen
- [ ] Integration tests vs 001 pass
- [ ] Error mapping contract finalized
- [ ] Staging smoke pass
