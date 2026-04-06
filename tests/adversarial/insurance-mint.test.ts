import { BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { activeEntryPda, setupBuyTicketFixture } from "../helpers/buy-ticket-fixture";

describe("insurance mint validation", () => {
  it("accepts insured entries for configured insurance mints", async () => {
    const fx = await setupBuyTicketFixture({
      acceptedMintsCount: 2,
      insuranceMintIndexes: [0, 1],
      maxInsuredTickets: 3,
    });

    const buyers = [
      { user: fx.user, payerAta: fx.userTokenAccounts[0] },
      { user: fx.operator, payerAta: fx.operatorTokenAccounts[1] },
    ];
    for (const [mintIndex, buyer] of buyers.entries()) {
      const [ticketRecordPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("ticket"), fx.instancePda.toBuffer(), buyer.user.publicKey.toBuffer()],
        fx.program.programId
      );

      await fx.program.methods
        .buyTicket({
          entryMode: { paid: {} },
          entryMint: fx.mints[mintIndex].publicKey,
          insured: true,
          entryTotalAmount: new BN(
            fx.ticketPrice + fx.entryFee + fx.insurancePremium
          ),
          insurancePremiumAmount: new BN(fx.insurancePremium),
          externalRef: null,
        } as any)
        .accounts({
          user: buyer.user.publicKey,
          operator: fx.operator.publicKey,
          payerAuthority: buyer.user.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          ticketRecord: ticketRecordPda,
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
  });

  it("rejects insured entry when mint is not in insurance set", async () => {
    const fx = await setupBuyTicketFixture({
      acceptedMintsCount: 3,
      insuranceMintIndexes: [0, 1],
    });

    await expect(
      fx.program.methods
        .buyTicket({
          entryMode: { paid: {} },
          entryMint: fx.mints[2].publicKey,
          insured: true,
          entryTotalAmount: new BN(
            fx.ticketPrice + fx.entryFee + fx.insurancePremium
          ),
          insurancePremiumAmount: new BN(fx.insurancePremium),
          externalRef: null,
        } as any)
        .accounts({
          user: fx.user.publicKey,
          operator: fx.operator.publicKey,
          payerAuthority: fx.user.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          ticketRecord: fx.ticketRecordPda,
          activeEntry: activeEntryPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
          entryMint: fx.mints[2].publicKey,
          payerEntryTokenAccount: fx.userTokenAccounts[2],
          treasuryVault: fx.treasuryVaults[2],
          globalLiquidityVault: fx.globalLiquidityVaults[2],
          liquidityAuthority: fx.liquidityAuthorityPda,
          devWalletTokenAccount: fx.devTokenAccounts[2],
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([fx.user, fx.operator])
        .rpc()
    ).rejects.toThrow();
  });
});
