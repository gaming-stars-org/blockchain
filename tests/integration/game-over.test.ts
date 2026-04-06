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

describe("game over behavior", () => {
  it("blocks new buys and still allows settlement cleanup", async () => {
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
      .setGameOver()
      .accounts({
        authority: fx.operator.publicKey,
        factoryState: fx.factoryStatePda,
        instance: fx.instancePda,
      } as any)
      .signers([fx.operator])
      .rpc();

    await expect(
      fx.program.methods
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
        .rpc()
    ).rejects.toThrow();

    const devBefore = await tokenAmount(fx.client, fx.devTokenAccounts[0]);
    const settlementId = settlementSeed(82);
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
        settlementReceipt: settlementReceiptPda(fx.program.programId, 82),
        instanceAuthority: fx.instanceAuthorityPda,
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
  });
});
