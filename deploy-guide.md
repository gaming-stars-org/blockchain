# Gaming Stars -Production Deployment

last updated 2026-03-24

## 1. Generate keypairs

four separate keypairs, each has its own role:

- **owner** - super-admin. inits factory, manages admins, updates wallets. immutable after init
- **operator** - co-signs ticket purchases, runs settlements, calls game_over. this is your backend
- **dev_wallet** - receives entry fees from every ticket purchase
- **master_wallet** - tops up global liquidity vault (insurance fund)

```bash
mkdir -p ./keypairs
solana-keygen new -o ./keypairs/owner.json --no-bip39-passphrase
solana-keygen new -o ./keypairs/operator.json --no-bip39-passphrase
solana-keygen new -o ./keypairs/dev-wallet.json --no-bip39-passphrase
solana-keygen new -o ./keypairs/master-wallet.json --no-bip39-passphrase
```

## 2. Fund owner with SOL

owner pays for all deployment txs. budget ~3 SOL on mainnet:
- ~2.5 SOL program deploy (rent-exempt storage for the ~607 KB compiled program binary — solana charges ~0.00000348 SOL/byte as a one-time deposit to keep account data on-chain permanently)
- ~0.3 SOL PDA account creation (factory, instances, vaults)
- ~0.2 SOL buffer for txs

```bash
# grab the address
solana-keygen pubkey ./keypairs/owner.json

# devnet
solana airdrop 5 <OWNER_PUBKEY> --url devnet
```

## 3. Configure txtx.yml

```bash
cp txtx.yml.example txtx.yml
```

edit for your target env:

```yaml
environments:
  mainnet:
    network_id: mainnet
    rpc_api_url: https://mainnet.helius-rpc.com/?api-key=<YOUR_KEY>
    payer_keypair_json: ./keypairs/owner.json
    authority_keypair_json: ./keypairs/owner.json
```

## 4. Build and deploy

```bash
anchor build
surfpool run deployment --env mainnet
```

grab the program ID from the output.

## 5. Save program ID

update `Anchor.toml`:

```toml
[programs.mainnet]
gaming_stars = "<PROGRAM_ID>"
```

update `declare_id!()` in `programs/gaming-stars/src/lib.rs` if you need to rebuild.

save for the client:

```
GAMING_STARS_PROGRAM_ID=<PROGRAM_ID>
```

## 6. Initialize factory

one-time call from owner. sets up the singleton `FactoryState` PDA.

```typescript
await program.methods
  .initializeFactory(
    devWalletPubkey,
    masterWalletPubkey,
    operatorWalletPubkey
  )
  .accounts({
    owner: ownerKeypair.publicKey,
    factoryState: factoryStatePDA, // seeds=["factory-state"]
    systemProgram: SystemProgram.programId,
  })
  .signers([ownerKeypair])
  .rpc();
```

---

## 7. Add admins (optional)

admins can deploy instances and manage vaults. up to 32.

```typescript
await program.methods
  .addAdmin(adminPubkey)
  .accounts({
    owner: ownerKeypair.publicKey,
    factoryState: factoryStatePDA,
  })
  .signers([ownerKeypair])
  .rpc();
```

---

## 8. Create token mint (if custom)

skip this if you're using USDC or an existing token.

```bash
spl-token create-token --decimals 6
# save the mint address
```

## 9. Create token accounts for dev and master wallets

these wallets need ATAs to receive/send tokens.

```bash
spl-token create-account <MINT> --owner <DEV_WALLET_PUBKEY>
spl-token create-account <MINT> --owner <MASTER_WALLET_PUBKEY>
```

## 10. Deploy a game instance

this also creates all vaults automatically (treasury + global liquidity per mint).

```typescript
await program.methods
  .deployInstance({
    instanceId: new BN(1),
    ticketPrice: new BN(900),
    entryFee: new BN(100),
    insurancePremium: new BN(50),
    maxInsuredTickets: 100,
    payoutRatioNum: 3,        // 3/2 = 1.5x payout
    payoutRatioDen: 2,
    gameDurationSecs: new BN(3600),
    userTtlSecs: new BN(300),
    acceptedMints: [usdcMint],
    insuranceMints: [usdcMint],
  })
  .accounts({
    authority: ownerKeypair.publicKey,
    factoryState: factoryStatePDA,
    instance: instancePDA,          // seeds=["instance", instance_id_le_bytes]
    instanceAuthority: instanceAuthorityPDA,  // seeds=["instance-authority", instance.key()]
    liquidityAuthority: liquidityAuthorityPDA, // seeds=["liquidity-authority"]
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .remainingAccounts([
    // for each mint: [mint, treasuryVault, globalLiquidityVault]
    { pubkey: usdcMint, isWritable: false, isSigner: false },
    { pubkey: treasuryVaultPDA, isWritable: true, isSigner: true },
    { pubkey: globalLiquidityVaultPDA, isWritable: true, isSigner: true },
  ])
  .signers([ownerKeypair])
  .rpc();
```

vaults are PDA-signed so they show as signers in remaining accounts.

no need to call `initTreasuryVault` or `initGlobalLiquidityVault` separately -`deployInstance` handles it. global liquidity vault is only created once per mint, subsequent instances reuse it.

## 11. Fund global liquidity vault

master wallet deposits into the insurance fund. do this before users start buying insured tickets.

```typescript
await program.methods
  .topupGlobalLiquidity({ mint: usdcMint, amount: new BN(100_000) })
  .accounts({
    masterWallet: masterKeypair.publicKey,
    factoryState: factoryStatePDA,
    // + vault accounts, token program, etc.
  })
  .signers([masterKeypair])
  .rpc();
```

## 12. Backend setup (operator service)

the operator service needs the operator keypair to:
- co-sign `buyTicket` (every ticket purchase)
- run `settlePayout`, `settleRefund`, `settleForfeit`
- batch settlements via `settleUsersBatch`
- call `setGameOver` when game ends

env vars for backend:

```
OPERATOR_KEYPAIR_PATH=./keypairs/operator.json
GAMING_STARS_PROGRAM_ID=<PROGRAM_ID>
RPC_URL=https://mainnet.helius-rpc.com/?api-key=<KEY>
```

## 13. Client integration

client needs:
- `GAMING_STARS_PROGRAM_ID`
- IDL from `target/types/gaming_stars.ts`
- RPC URL
- operator public key (not the private key)
