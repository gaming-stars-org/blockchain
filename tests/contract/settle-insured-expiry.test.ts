import { BN } from "@coral-xyz/anchor";
import { SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  settlementReceiptPda,
  settlementSeed,
  setupBuyTicketFixture,
  ticketPda,
  activeEntryPda,
  tokenAmount,
} from "../helpers/buy-ticket-fixture";

describe("settle_insured_expiry", () => {
  it("forfeits treasury to dev wallet and refunds GLV to user in one tx", async () => {
    const fx = await setupBuyTicketFixture();

    await fx.program.methods
      .buyTicket({
        entryMode: { paid: {} },
        entryMint: fx.mints[0].publicKey,
        insured: true,
        entryTotalAmount: new BN(fx.ticketPrice + fx.entryFee + fx.insurancePremium),
        insurancePremiumAmount: new BN(fx.insurancePremium),
        externalRef: null,
      } as any)
      .accounts({
        user: fx.user.publicKey,
        operator: fx.operator.publicKey,
        payerAuthority: fx.user.publicKey,
        factoryState: fx.factoryStatePda,
        instance: fx.instancePda,
        ticketRecord: ticketPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
        activeEntry: activeEntryPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
        entryMint: fx.mints[0].publicKey,
        payerEntryTokenAccount: fx.userTokenAccounts[0],
        treasuryVault: fx.treasuryVaults[0],
        globalLiquidityVault: fx.globalLiquidityVaults[0],
        liquidityAuthority: fx.liquidityAuthorityPda,
        devWalletTokenAccount: fx.devTokenAccounts[0],
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([fx.user, fx.operator])
      .rpc();

    await fx.program.methods
      .topupGlobalLiquidity({
        mint: fx.mints[0].publicKey,
        amount: new BN(1_000),
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

    const devBefore = await tokenAmount(fx.client, fx.devTokenAccounts[0]);
    const vaultBefore = await tokenAmount(fx.client, fx.globalLiquidityVaults[0]);
    const userBefore = await tokenAmount(fx.client, fx.userTokenAccounts[0]);

    const settlementId = settlementSeed(51);
    await fx.program.methods
      .settleInsuredExpiry({
        settlementId,
        instanceId: fx.instanceId,
        ticketId: new BN(0),
        beneficiary: fx.user.publicKey,
        legs: [
          {
            mint: fx.mints[0].publicKey,
            amount: new BN(fx.ticketPrice),
            sourceVault: fx.treasuryVaults[0],
            destinationAta: fx.devTokenAccounts[0],
          },
        ],
        refundMint: fx.mints[0].publicKey,
        refundAmount: new BN(fx.ticketPrice),
        resolutionKind: { timeout: {} },
        payloadHash: settlementId,
      } as any)
      .accounts({
        operator: fx.operator.publicKey,
        factoryState: fx.factoryStatePda,
        instance: fx.instancePda,
        ticketRecord: ticketPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
        activeEntry: activeEntryPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
        settlementReceipt: settlementReceiptPda(fx.program.programId, 51),
        instanceAuthority: fx.instanceAuthorityPda,
        refundMint: fx.mints[0].publicKey,
        globalLiquidityVault: fx.globalLiquidityVaults[0],
        beneficiaryTokenAccount: fx.userTokenAccounts[0],
        liquidityAuthority: fx.liquidityAuthorityPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts([
        { pubkey: fx.mints[0].publicKey, isSigner: false, isWritable: false },
        { pubkey: fx.treasuryVaults[0], isSigner: false, isWritable: true },
        { pubkey: fx.devTokenAccounts[0], isSigner: false, isWritable: true },
      ])
      .signers([fx.operator])
      .rpc();

    expect(await tokenAmount(fx.client, fx.devTokenAccounts[0])).toBe(
      devBefore + BigInt(fx.ticketPrice)
    );
    expect(await tokenAmount(fx.client, fx.globalLiquidityVaults[0])).toBe(
      vaultBefore - BigInt(fx.ticketPrice)
    );
    expect(await tokenAmount(fx.client, fx.userTokenAccounts[0])).toBe(
      userBefore + BigInt(fx.ticketPrice)
    );
  });

  it("with empty legs skips treasury transfer but still refunds from GLV", async () => {
    const fx = await setupBuyTicketFixture();

    await fx.program.methods
      .buyTicket({
        entryMode: { paid: {} },
        entryMint: fx.mints[0].publicKey,
        insured: true,
        entryTotalAmount: new BN(fx.ticketPrice + fx.entryFee + fx.insurancePremium),
        insurancePremiumAmount: new BN(fx.insurancePremium),
        externalRef: null,
      } as any)
      .accounts({
        user: fx.user.publicKey,
        operator: fx.operator.publicKey,
        payerAuthority: fx.user.publicKey,
        factoryState: fx.factoryStatePda,
        instance: fx.instancePda,
        ticketRecord: ticketPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
        activeEntry: activeEntryPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
        entryMint: fx.mints[0].publicKey,
        payerEntryTokenAccount: fx.userTokenAccounts[0],
        treasuryVault: fx.treasuryVaults[0],
        globalLiquidityVault: fx.globalLiquidityVaults[0],
        liquidityAuthority: fx.liquidityAuthorityPda,
        devWalletTokenAccount: fx.devTokenAccounts[0],
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([fx.user, fx.operator])
      .rpc();

    await fx.program.methods
      .topupGlobalLiquidity({
        mint: fx.mints[0].publicKey,
        amount: new BN(1_000),
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

    const vaultBefore = await tokenAmount(fx.client, fx.globalLiquidityVaults[0]);
    const userBefore = await tokenAmount(fx.client, fx.userTokenAccounts[0]);
    const treasuryBefore = await tokenAmount(fx.client, fx.treasuryVaults[0]);

    const settlementId = settlementSeed(53);
    await fx.program.methods
      .settleInsuredExpiry({
        settlementId,
        instanceId: fx.instanceId,
        ticketId: new BN(0),
        beneficiary: fx.user.publicKey,
        legs: [],
        refundMint: fx.mints[0].publicKey,
        refundAmount: new BN(fx.ticketPrice),
        resolutionKind: { timeout: {} },
        payloadHash: settlementId,
      } as any)
      .accounts({
        operator: fx.operator.publicKey,
        factoryState: fx.factoryStatePda,
        instance: fx.instancePda,
        ticketRecord: ticketPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
        activeEntry: activeEntryPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
        settlementReceipt: settlementReceiptPda(fx.program.programId, 53),
        instanceAuthority: fx.instanceAuthorityPda,
        refundMint: fx.mints[0].publicKey,
        globalLiquidityVault: fx.globalLiquidityVaults[0],
        beneficiaryTokenAccount: fx.userTokenAccounts[0],
        liquidityAuthority: fx.liquidityAuthorityPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts([])
      .signers([fx.operator])
      .rpc();

    expect(await tokenAmount(fx.client, fx.treasuryVaults[0])).toBe(treasuryBefore);
    expect(await tokenAmount(fx.client, fx.globalLiquidityVaults[0])).toBe(
      vaultBefore - BigInt(fx.ticketPrice)
    );
    expect(await tokenAmount(fx.client, fx.userTokenAccounts[0])).toBe(
      userBefore + BigInt(fx.ticketPrice)
    );
  });

  it("rejects non-insured ticket", async () => {
    const fx = await setupBuyTicketFixture();

    await fx.program.methods
      .buyTicket({
        entryMode: { paid: {} },
        entryMint: fx.mints[0].publicKey,
        insured: false,
        entryTotalAmount: new BN(fx.ticketPrice + fx.entryFee),
        insurancePremiumAmount: new BN(0),
        externalRef: null,
      } as any)
      .accounts({
        user: fx.user.publicKey,
        operator: fx.operator.publicKey,
        payerAuthority: fx.user.publicKey,
        factoryState: fx.factoryStatePda,
        instance: fx.instancePda,
        ticketRecord: ticketPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
        activeEntry: activeEntryPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
        entryMint: fx.mints[0].publicKey,
        payerEntryTokenAccount: fx.userTokenAccounts[0],
        treasuryVault: fx.treasuryVaults[0],
        globalLiquidityVault: fx.globalLiquidityVaults[0],
        liquidityAuthority: fx.liquidityAuthorityPda,
        devWalletTokenAccount: fx.devTokenAccounts[0],
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([fx.user, fx.operator])
      .rpc();

    await fx.program.methods
      .topupGlobalLiquidity({
        mint: fx.mints[0].publicKey,
        amount: new BN(1_000),
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

    const settlementId = settlementSeed(52);
    await expect(
      fx.program.methods
        .settleInsuredExpiry({
          settlementId,
          instanceId: fx.instanceId,
          ticketId: new BN(0),
          beneficiary: fx.user.publicKey,
          legs: [
            {
              mint: fx.mints[0].publicKey,
              amount: new BN(fx.ticketPrice),
              sourceVault: fx.treasuryVaults[0],
              destinationAta: fx.devTokenAccounts[0],
            },
          ],
          refundMint: fx.mints[0].publicKey,
          refundAmount: new BN(fx.ticketPrice),
          resolutionKind: { timeout: {} },
          payloadHash: settlementId,
        } as any)
        .accounts({
          operator: fx.operator.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          ticketRecord: ticketPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
          activeEntry: activeEntryPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
          settlementReceipt: settlementReceiptPda(fx.program.programId, 52),
          instanceAuthority: fx.instanceAuthorityPda,
          refundMint: fx.mints[0].publicKey,
          globalLiquidityVault: fx.globalLiquidityVaults[0],
          beneficiaryTokenAccount: fx.userTokenAccounts[0],
          liquidityAuthority: fx.liquidityAuthorityPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .remainingAccounts([
          { pubkey: fx.mints[0].publicKey, isSigner: false, isWritable: false },
          { pubkey: fx.treasuryVaults[0], isSigner: false, isWritable: true },
          { pubkey: fx.devTokenAccounts[0], isSigner: false, isWritable: true },
        ])
        .signers([fx.operator])
        .rpc()
    ).rejects.toThrow();
  });
});
