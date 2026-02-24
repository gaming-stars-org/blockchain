# Feature Specification: Gaming Stars Smart Contracts Core

**Feature Branch**: `001-gaming-stars-foundation`  
**Created**: 2026-02-23  
**Status**: Approved  
**Input**: Smart-contract-first production scope

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Controlled Entry and Custody (Priority: P1)

As a player and operations team, ticket entry must be strictly authorized and funds split atomically.

**Why this priority**: This is the primary on-chain risk surface.

**Independent Test**: Deploy one instance, execute paid/sponsored entries, verify balances and `TicketRecord` creation.

**Acceptance Scenarios**:

1. **Given** active instance and accepted mint, **When** paid entry uses user signer + operator co-signer, **Then** principal goes to treasury and fee goes to dev wallet ATA.
2. **Given** sponsored entry with `insured=true`, **When** `buy_ticket` executes, **Then** it fails before transfer.
3. **Given** missing/wrong operator signer, **When** `buy_ticket` executes, **Then** it fails before transfer.
4. **Given** insured cap is reached for instance, **When** `buy_ticket(insured=true)` executes, **Then** it fails before transfer.

---

### User Story 2 - Deterministic Settlement and Replay Safety (Priority: P2)

As backend operations, settlement must be idempotent and auditable with no double execution.

**Why this priority**: Settlement correctness defines financial integrity.

**Independent Test**: Execute payout/refund/forfeit once, retry same `settlement_id`, verify rejection.

**Acceptance Scenarios**:

1. **Given** active ticket and valid payout legs, **When** `settle_payout` runs, **Then** all legs transfer atomically and receipt is created.
2. **Given** insured ticket, **When** `settle_refund` runs, **Then** refund sources from global liquidity vault matching refund mint (`USDT` or `USDC`) only.
3. **Given** repeated `settlement_id`, **When** settlement is retried, **Then** it fails before transfer.

---

### User Story 3 - Operational Safety Controls (Priority: P3)

As operators, we need freeze/unfreeze/game-over controls for incident handling.

**Why this priority**: Required for production safety.

**Independent Test**: Freeze instance and confirm blocked money movement; game-over blocks buys but allows cleanup settlement.

**Acceptance Scenarios**:

1. **Given** paused instance, **When** money-moving instructions execute, **Then** they fail.
2. **Given** game-over instance, **When** `buy_ticket` executes, **Then** it fails.
3. **Given** rotated operator wallet, **When** old wallet signs privileged call, **Then** it fails.
4. **Given** multiple admins configured by owner, **When** any admin deploys or pauses/unpauses an instance, **Then** action succeeds with correct authorization.

### Edge Cases

- Entry mint not in `accepted_mints`.
- `entry_total_amount` mismatch.
- Sponsored payer not operator.
- Insured cap reached during burst traffic.
- Beneficiary not equal to `ticket.owner` for payout/refund.
- Wrong vault passed in settlement leg.
- Duplicate settlement IDs in batch.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Contract MUST initialize one global `FactoryState`.
- **FR-002**: Contract MUST support multiple Admin addresses managed by owner.
- **FR-003**: Only owner MUST update global wallets and manage admin list.
- **FR-004**: Owner or Admin MUST be allowed to deploy/freeze/unfreeze instances.
- **FR-005**: Only master wallet MUST top up global liquidity vaults for supported insurance mints (`USDT`, `USDC`).
- **FR-006**: `buy_ticket` MUST require user signer and valid operator co-signer.
- **FR-007**: `buy_ticket` MUST enforce `paid=user` and `sponsored=operator` payer mapping.
- **FR-008**: `buy_ticket` MUST reject `sponsored + insured`.
- **FR-009**: `buy_ticket` MUST enforce exact amount checks and atomic split.
- **FR-010**: `buy_ticket` MUST reject insured entry when `insured_tickets_count >= max_insured_tickets`.
- **FR-011**: Settlement instructions MUST enforce beneficiary ownership and vault consistency.
- **FR-012**: Settlement MUST be idempotent via unique `SettlementReceipt` PDA.
- **FR-013**: Pause MUST block all money-moving instructions.
- **FR-014**: Game-over MUST block new entries and allow settlement cleanup.
- **FR-015**: Contract MUST emit canonical events and return canonical error codes.
- **FR-016**: No owner/admin path MAY drain principal directly from treasury.
- **FR-017**: Backend MUST pre-check insured capacity and reject entry requests when no insured slots remain.

### Key Entities *(include if feature involves data)*

- **FactoryState**
- **GameInstance**
- **TicketRecord**
- **SettlementReceipt**
- **Treasury Vault (instance+mint)**
- **Global Liquidity Vaults (USDT, USDC)**

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% required smart-contract test matrix passes on localnet and devnet.
- **SC-002**: 0 double-settlement execution across retry simulations.
- **SC-003**: 100% forbidden-state and unauthorized calls fail before transfer.
- **SC-004**: 100% successful privileged/money instructions emit expected events.

## Out of Scope for 001

- Backend queue/referral/timer business engine.
- Backend API implementation.
- Frontend product UI.
