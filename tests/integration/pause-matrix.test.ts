import { BN } from "@coral-xyz/anchor";
import { SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  settlementReceiptPda,
  settlementSeed,
  setupBuyTicketFixture,
  ticketPda,
  tokenAmount,
} from "../helpers/buy-ticket-fixture";

describe("pause matrix", () => {
  it("blocks money-moving entry and settlement while paused", async () => {
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
        ticketRecord: ticketPda(fx.program.programId, fx.instancePda, 0),
        entryMint: fx.mints[0].publicKey,
        payerEntryTokenAccount: fx.userTokenAccounts[0],
        treasuryVault: fx.treasuryVaults[0],
        devWalletTokenAccount: fx.devTokenAccounts[0],
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([fx.user, fx.operator])
      .rpc();

    await fx.program.methods
      .freezeInstance()
      .accounts({
        authority: fx.owner.publicKey,
        factoryState: fx.factoryStatePda,
        instance: fx.instancePda,
      } as any)
      .signers([fx.owner])
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
          ticketRecord: ticketPda(fx.program.programId, fx.instancePda, 1),
          entryMint: fx.mints[0].publicKey,
          payerEntryTokenAccount: fx.userTokenAccounts[0],
          treasuryVault: fx.treasuryVaults[0],
          devWalletTokenAccount: fx.devTokenAccounts[0],
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([fx.user, fx.operator])
        .rpc()
    ).rejects.toThrow();

    const userBefore = await tokenAmount(fx.client, fx.userTokenAccounts[0]);
    const settlementId = settlementSeed(81);
    await expect(
      fx.program.methods
        .settlePayout({
          settlementId,
          instanceId: fx.instanceId,
          ticketId: new BN(0),
          beneficiary: fx.user.publicKey,
          legs: [
            {
              mint: fx.mints[0].publicKey,
              amount: new BN(fx.ticketPrice),
              sourceVault: fx.treasuryVaults[0],
              destinationAta: fx.userTokenAccounts[0],
            },
          ],
          resolutionKind: { win: {} },
          payloadHash: settlementId,
        } as any)
        .accounts({
          operator: fx.operator.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          ticketRecord: ticketPda(fx.program.programId, fx.instancePda, 0),
          settlementReceipt: settlementReceiptPda(fx.program.programId, 81),
          instanceAuthority: fx.instanceAuthorityPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .remainingAccounts([
          { pubkey: fx.mints[0].publicKey, isSigner: false, isWritable: false },
          { pubkey: fx.treasuryVaults[0], isSigner: false, isWritable: true },
          { pubkey: fx.userTokenAccounts[0], isSigner: false, isWritable: true },
        ])
        .signers([fx.operator])
        .rpc()
    ).rejects.toThrow();

    expect(await tokenAmount(fx.client, fx.userTokenAccounts[0])).toBe(userBefore);
  });
});
