# Tasks: Gaming Stars Backend Orchestration

## Phase 1: Setup

- [ ] T001 Create backend service skeleton in `backend/src/`
- [ ] T002 Create OpenAPI-first route scaffolding in `backend/src/api/`
- [ ] T003 Create DB migrations for idempotency store

## Phase 2: Core

- [ ] T004 Implement settlement ID generator
- [ ] T005 Implement pre-submit validators for entry and settlement
- [ ] T006 Implement idempotency persistence and conflict handling
- [ ] T007 Implement chain submission and confirmation service
- [ ] T008 Implement canonical error mapper

## Phase 3: APIs

- [ ] T009 Implement `/v1/entries/submit`
- [ ] T010 Implement `/v1/settlements/payout`
- [ ] T011 Implement `/v1/settlements/refund`
- [ ] T012 Implement `/v1/settlements/forfeit`

## Phase 4: Reliability and Ops

- [ ] T013 Add metrics and alerts hooks
- [ ] T014 Add runbook-linked structured logging
- [ ] T015 Execute integration tests against `001` on localnet/devnet
