# Research: Gaming Stars Foundation

## Goal

Lock technical decisions that remove implementation ambiguity before coding.

## Decisions

### 1. Authority Model

- Decision: Keep one global `owner`, `master_wallet`, and `operator_wallet` in `FactoryState`.
- Rationale: Minimizes branching logic and supports deterministic validation.
- Tradeoff: Global key compromise impact is larger; mitigated by freeze + rotation runbooks.

### 2. Entry Authorization

- Decision: `buy_ticket` always requires user signer + operator co-signer.
- Rationale: Enforces backend-gated entry policy and prevents direct script bypass.
- Tradeoff: Backend/operator availability becomes dependency for entry.

### 3. Entry Modes

- Decision: Keep exactly two modes: `paid` and `sponsored`.
- Rationale: Explicit funding source and simpler audit path.
- Tradeoff: No flexible hybrid modes; avoids policy ambiguity.

### 4. Insurance Model

- Decision: Insurance premium and refunds support two insurance mints only: `USDT` and `USDC`, each with dedicated global liquidity vault.
- Rationale: Keeps operational flexibility for stablecoin liquidity while preserving bounded complexity.
- Tradeoff: Slightly more validation and monitoring surface than single-mint design.

### 5. Replay Protection

- Decision: Global uniqueness of `settlement_id` via `SettlementReceipt` PDA.
- Rationale: Prevents cross-instance replay and guarantees at-most-once settlement execution.
- Tradeoff: Requires deterministic backend id generation discipline.

### 6. Settlement Execution

- Decision: Keep single-item settlement instructions plus optional batch wrapper.
- Rationale: Single-item instructions are easier to reason about and test; batch is throughput optimization.
- Tradeoff: Batch atomic failure may require backend splitting.

### 7. Pause and Game-Over Semantics

- Decision: Pause blocks all money movement; game-over blocks only new entries.
- Rationale: Enables safe incident containment while preserving cleanup capabilities.
- Tradeoff: Operators need clear playbooks for transition coordination.

### 8. Event and Error Model

- Decision: Canonical event catalog and error mapping are mandatory.
- Rationale: Required for forensic audit and API observability.
- Tradeoff: Slightly higher implementation overhead.

## Rejected Alternatives

- Fully on-chain queue/referral engine: rejected due to complexity and operational inflexibility.
- Open/public entry without backend co-sign: rejected due to abuse and policy bypass risk.
- Instance-scoped settlement IDs: rejected due to replay ambiguity across instances.
