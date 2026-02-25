# gaming-stars Runbooks

This repository uses Surfpool runbooks for reproducible program deployments.

## Quickstart

1. Copy configuration:
   - `cp txtx.yml.example txtx.yml`
2. Build:
   - `anchor build`
3. List available runbooks:
   - `surfpool ls`
4. Deploy:
   - `surfpool run deployment --env localnet`

## Environments

- `localnet`: local Surfpool RPC (`http://127.0.0.1:8899`)
- `devnet`: Solana devnet
- `mainnet`: Solana mainnet
