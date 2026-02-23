# gaming-start Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-23

## Active Technologies
- Rust 1.77+ (Anchor), TypeScript 5.x (backend/integration) + Anchor, Solana Program Library (SPL Token), @solana/web3.js, @coral-xyz/anchor, Fastify (backend API) (001-gaming-stars-foundation)
- On-chain Solana accounts + backend relational store for projections/idempotency audit (PostgreSQL recommended) (001-gaming-stars-foundation)

## Project Structure

```text
specs/
├── 001-gaming-stars-foundation/   # Smart contracts core
├── 002-backend-orchestration/     # Backend API + orchestration
├── 003-frontend-app/              # Frontend product UI
└── SEQUENCE.md

.specify/
├── memory/constitution.md
├── templates/
└── scripts/bash/
```

## Commands

- `make specify SPECIFY_DESC="your feature description"`
- `make plan FEATURE=001-gaming-stars-foundation`
- `make tasks FEATURE=001-gaming-stars-foundation`
- `make check FEATURE=001-gaming-stars-foundation`
- `make agent FEATURE=001-gaming-stars-foundation`

## Code Style

- Follow existing project conventions.
- Keep changes spec-aligned (`001 -> 002 -> 003`).
- Add tests for new behavior or document why tests are not feasible.

## Recent Changes
- 001-gaming-stars-foundation: Added Rust 1.77+ (Anchor), TypeScript 5.x (backend/integration) + Anchor, Solana Program Library (SPL Token), @solana/web3.js, @coral-xyz/anchor, Fastify (backend API)
- Split delivery into sequenced specs: `001` smart contracts, `002` backend, `003` frontend

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
