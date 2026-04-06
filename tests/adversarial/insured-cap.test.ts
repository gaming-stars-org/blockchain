import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { activeEntryPda, setupBuyTicketFixture } from "../helpers/buy-ticket-fixture";

describe("insured cap guard", () => {
  it("allows up to max insured tickets and rejects overflow", async () => {
    const fx = await setupBuyTicketFixture({ maxInsuredTickets: 2 });

    const buyers = [
      { user: fx.user, payerAta: fx.userTokenAccounts[0] },
      { user: fx.operator, payerAta: fx.operatorTokenAccounts[0] },
    ];
    for (const [, buyer] of buyers.entries()) {
      const [ticketRecordPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("ticket"), fx.instancePda.toBuffer(), buyer.user.publicKey.toBuffer()],
        fx.program.programId
      );

      await fx.program.methods
        .buyTicket({
          entryMode: { paid: {} },
          entryMint: fx.mints[0].publicKey,
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
          entryMint: fx.mints[0].publicKey,
          payerEntryTokenAccount: buyer.payerAta,
          treasuryVault: fx.treasuryVaultPda,
          globalLiquidityVault: fx.globalLiquidityVaults[0],
          liquidityAuthority: fx.liquidityAuthorityPda,
          devWalletTokenAccount: fx.devTokenAccounts[0],
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers(buyer.user.publicKey.equals(fx.operator.publicKey) ? [fx.operator] : [fx.user, fx.operator])
        .rpc();
    }

    const instance = await fx.program.account.gameInstance.fetch(fx.instancePda);
    expect(instance.insuredTicketsCount).toBe(2);

    const [overflowTicketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("ticket"), fx.instancePda.toBuffer(), fx.masterWallet.publicKey.toBuffer()],
      fx.program.programId
    );

    await expect(
      fx.program.methods
        .buyTicket({
          entryMode: { paid: {} },
          entryMint: fx.mints[0].publicKey,
          insured: true,
          entryTotalAmount: new BN(
            fx.ticketPrice + fx.entryFee + fx.insurancePremium
          ),
          insurancePremiumAmount: new BN(fx.insurancePremium),
          externalRef: null,
        } as any)
        .accounts({
          user: fx.masterWallet.publicKey,
          operator: fx.operator.publicKey,
          payerAuthority: fx.masterWallet.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          ticketRecord: overflowTicketPda,
          activeEntry: activeEntryPda(
            fx.program.programId,
            fx.instancePda,
            fx.masterWallet.publicKey
          ),
          entryMint: fx.mints[0].publicKey,
          payerEntryTokenAccount: fx.masterTokenAccounts[0],
          treasuryVault: fx.treasuryVaultPda,
          globalLiquidityVault: fx.globalLiquidityVaults[0],
          liquidityAuthority: fx.liquidityAuthorityPda,
          devWalletTokenAccount: fx.devTokenAccounts[0],
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([fx.masterWallet, fx.operator])
        .rpc()
    ).rejects.toThrow();
  });
});
