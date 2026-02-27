# Gaming Stars Smart Contracts

## Stack
- Rust + Anchor
- SPL Token / Token Interface
- TypeScript tests (Jest + LiteSVM)

## Repo Layout
- `programs/gaming-stars/` - on-chain program
- `tests/` - contract/integration/adversarial tests

## Commands
- Build: `anchor build`
- Test: `anchor test`
- Deploy via Surfpool runbook (localnet/devnet/mainnet): `surfpool run deployment --env localnet|devnet|mainnet`

## Surfpool IaC
- Copy config: `cp txtx.yml.example txtx.yml`
- Start local Surfpool: `surfpool start --no-tui`
- List runbooks: `surfpool ls`
- Run deploy runbook: `surfpool run deployment --env localnet`
