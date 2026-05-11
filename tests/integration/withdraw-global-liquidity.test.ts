import { BN } from "@coral-xyz/anchor";
import { SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  setupBuyTicketFixture,
  tokenAmount,
} from "../helpers/buy-ticket-fixture";

async function topup(fx: any, mintIndex: number, amount: number) {
  await fx.program.methods
    .topupGlobalLiquidity({
      mint: fx.mints[mintIndex].publicKey,
      amount: new BN(amount),
    } as any)
    .accounts({
      masterWallet: fx.masterWallet.publicKey,
      factoryState: fx.factoryStatePda,
      mint: fx.mints[mintIndex].publicKey,
      masterTokenAccount: fx.masterTokenAccounts[mintIndex],
      globalLiquidityVault: fx.globalLiquidityVaults[mintIndex],
      liquidityAuthority: fx.liquidityAuthorityPda,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .signers([fx.masterWallet])
    .rpc();
}

describe("withdraw_global_liquidity", () => {
  it("rejects non-master signer", async () => {
    const fx = await setupBuyTicketFixture({ acceptedMintsCount: 1 });
    await topup(fx, 0, 1_000);

    await expect(
      fx.program.methods
        .withdrawGlobalLiquidity({
          mint: fx.mints[0].publicKey,
          amount: new BN(500),
        } as any)
        .accounts({
          masterWallet: fx.operator.publicKey,
          factoryState: fx.factoryStatePda,
          mint: fx.mints[0].publicKey,
          masterTokenAccount: fx.operatorTokenAccounts[0],
          globalLiquidityVault: fx.globalLiquidityVaults[0],
          liquidityAuthority: fx.liquidityAuthorityPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .signers([fx.operator])
        .rpc()
    ).rejects.toThrow(/Unauthorized/);
  });

  it("rejects amount > vault balance with InsufficientVaultBalance", async () => {
    const fx = await setupBuyTicketFixture({ acceptedMintsCount: 1 });
    await topup(fx, 0, 1_000);

    await expect(
      fx.program.methods
        .withdrawGlobalLiquidity({
          mint: fx.mints[0].publicKey,
          amount: new BN(1_001),
        } as any)
        .accounts({
          masterWallet: fx.masterWallet.publicKey,
          factoryState: fx.factoryStatePda,
          mint: fx.mints[0].publicKey,
          masterTokenAccount: fx.masterTokenAccounts[0],
          globalLiquidityVault: fx.globalLiquidityVaults[0],
          liquidityAuthority: fx.liquidityAuthorityPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .signers([fx.masterWallet])
        .rpc()
    ).rejects.toThrow(/InsufficientVaultBalance/);
  });

  it("rejects zero amount with InvalidAmount", async () => {
    const fx = await setupBuyTicketFixture({ acceptedMintsCount: 1 });
    await topup(fx, 0, 1_000);

    await expect(
      fx.program.methods
        .withdrawGlobalLiquidity({
          mint: fx.mints[0].publicKey,
          amount: new BN(0),
        } as any)
        .accounts({
          masterWallet: fx.masterWallet.publicKey,
          factoryState: fx.factoryStatePda,
          mint: fx.mints[0].publicKey,
          masterTokenAccount: fx.masterTokenAccounts[0],
          globalLiquidityVault: fx.globalLiquidityVaults[0],
          liquidityAuthority: fx.liquidityAuthorityPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .signers([fx.masterWallet])
        .rpc()
    ).rejects.toThrow(/InvalidAmount/);
  });

  it("transfers tokens from GLV back to master ATA on happy path", async () => {
    const fx = await setupBuyTicketFixture({ acceptedMintsCount: 1 });
    await topup(fx, 0, 1_500);

    const masterBefore = await tokenAmount(fx.client, fx.masterTokenAccounts[0]);
    const glvBefore = await tokenAmount(fx.client, fx.globalLiquidityVaults[0]);

    await fx.program.methods
      .withdrawGlobalLiquidity({
        mint: fx.mints[0].publicKey,
        amount: new BN(700),
      } as any)
      .accounts({
        masterWallet: fx.masterWallet.publicKey,
        factoryState: fx.factoryStatePda,
        mint: fx.mints[0].publicKey,
        masterTokenAccount: fx.masterTokenAccounts[0],
        globalLiquidityVault: fx.globalLiquidityVaults[0],
        liquidityAuthority: fx.liquidityAuthorityPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .signers([fx.masterWallet])
      .rpc();

    const masterAfter = await tokenAmount(fx.client, fx.masterTokenAccounts[0]);
    const glvAfter = await tokenAmount(fx.client, fx.globalLiquidityVaults[0]);

    expect(masterAfter - masterBefore).toBe(BigInt(700));
    expect(glvBefore - glvAfter).toBe(BigInt(700));
  });
});
