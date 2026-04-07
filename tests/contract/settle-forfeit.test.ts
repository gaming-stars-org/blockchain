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

describe("settle_forfeit", () => {
  it("moves treasury funds across multiple legs and marks forfeited", async () => {
    const fx = await setupBuyTicketFixture();

    const buyers = [
      { user: fx.user, payerAta: fx.userTokenAccounts[0] },
      { user: fx.operator, payerAta: fx.operatorTokenAccounts[1] },
    ];
    for (const [mintIndex, buyer] of buyers.entries()) {
      await fx.program.methods
        .buyTicket({
          entryMode: { paid: {} },
          entryMint: fx.mints[mintIndex].publicKey,
          insured: false,
          entryTotalAmount: new BN(fx.ticketPrice + fx.entryFee),
          insurancePremiumAmount: new BN(0),
          externalRef: null,
        } as any)
        .accounts({
          user: buyer.user.publicKey,
          operator: fx.operator.publicKey,
          payerAuthority: buyer.user.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          ticketRecord: ticketPda(fx.program.programId, fx.instancePda, buyer.user.publicKey),
          activeEntry: activeEntryPda(fx.program.programId, fx.instancePda, buyer.user.publicKey),
          entryMint: fx.mints[mintIndex].publicKey,
          payerEntryTokenAccount: buyer.payerAta,
          treasuryVault: fx.treasuryVaults[mintIndex],
          globalLiquidityVault: fx.globalLiquidityVaults[mintIndex],
          liquidityAuthority: fx.liquidityAuthorityPda,
          devWalletTokenAccount: fx.devTokenAccounts[mintIndex],
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers(buyer.user.publicKey.equals(fx.operator.publicKey) ? [fx.operator] : [fx.user, fx.operator])
        .rpc();
    }

    const dev0Before = await tokenAmount(fx.client, fx.devTokenAccounts[0]);
    const dev1Before = await tokenAmount(fx.client, fx.devTokenAccounts[1]);

    const settlementId = settlementSeed(41);
    await fx.program.methods
      .settleForfeit({
        settlementId,
        instanceId: fx.instanceId,
        ticketId: new BN(0),
        owner: fx.user.publicKey,
        legs: [
          {
            mint: fx.mints[0].publicKey,
            amount: new BN(fx.ticketPrice),
            sourceVault: fx.treasuryVaults[0],
            destinationAta: fx.devTokenAccounts[0],
          },
          {
            mint: fx.mints[1].publicKey,
            amount: new BN(fx.ticketPrice),
            sourceVault: fx.treasuryVaults[1],
            destinationAta: fx.devTokenAccounts[1],
          },
        ],
        resolutionKind: { loss: {} },
        payloadHash: settlementId,
      } as any)
      .accounts({
        operator: fx.operator.publicKey,
        factoryState: fx.factoryStatePda,
        instance: fx.instancePda,
        ticketRecord: ticketPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
        activeEntry: activeEntryPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
        settlementReceipt: settlementReceiptPda(fx.program.programId, 41),
        instanceAuthority: fx.instanceAuthorityPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts([
        { pubkey: fx.mints[0].publicKey, isSigner: false, isWritable: false },
        { pubkey: fx.treasuryVaults[0], isSigner: false, isWritable: true },
        { pubkey: fx.devTokenAccounts[0], isSigner: false, isWritable: true },
        { pubkey: fx.mints[1].publicKey, isSigner: false, isWritable: false },
        { pubkey: fx.treasuryVaults[1], isSigner: false, isWritable: true },
        { pubkey: fx.devTokenAccounts[1], isSigner: false, isWritable: true },
      ])
      .signers([fx.operator])
      .rpc();

    expect(await tokenAmount(fx.client, fx.devTokenAccounts[0])).toBe(
      dev0Before + BigInt(fx.ticketPrice)
    );
    expect(await tokenAmount(fx.client, fx.devTokenAccounts[1])).toBe(
      dev1Before + BigInt(fx.ticketPrice)
    );
  });

  it("succeeds with empty legs and closes ticket without transfer", async () => {
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

    const devBefore = await tokenAmount(fx.client, fx.devTokenAccounts[0]);
    const vaultBefore = await tokenAmount(fx.client, fx.treasuryVaults[0]);

    const settlementId = settlementSeed(42);
    await fx.program.methods
      .settleForfeit({
        settlementId,
        instanceId: fx.instanceId,
        ticketId: new BN(0),
        owner: fx.user.publicKey,
        legs: [],
        resolutionKind: { loss: {} },
        payloadHash: settlementId,
      } as any)
      .accounts({
        operator: fx.operator.publicKey,
        factoryState: fx.factoryStatePda,
        instance: fx.instancePda,
        ticketRecord: ticketPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
        activeEntry: activeEntryPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
        settlementReceipt: settlementReceiptPda(fx.program.programId, 42),
        instanceAuthority: fx.instanceAuthorityPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts([])
      .signers([fx.operator])
      .rpc();

    expect(await tokenAmount(fx.client, fx.devTokenAccounts[0])).toBe(devBefore);
    expect(await tokenAmount(fx.client, fx.treasuryVaults[0])).toBe(vaultBefore);
  });
});
