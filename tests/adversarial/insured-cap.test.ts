import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { setupBuyTicketFixture } from "../helpers/buy-ticket-fixture";

describe("insured cap guard", () => {
  it("allows up to max insured tickets and rejects overflow", async () => {
    const fx = await setupBuyTicketFixture({ maxInsuredTickets: 2 });

    for (const ticketId of [0, 1]) {
      const ticketSeed = new BN(ticketId).toArrayLike(Buffer, "le", 8);
      const [ticketRecordPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("ticket"), fx.instancePda.toBuffer(), ticketSeed],
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
          user: fx.user.publicKey,
          operator: fx.operator.publicKey,
          payerAuthority: fx.user.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          ticketRecord: ticketRecordPda,
          entryMint: fx.mints[0].publicKey,
          payerEntryTokenAccount: fx.userTokenAccounts[0],
          treasuryVault: fx.treasuryVaultPda,
          globalLiquidityVault: fx.globalLiquidityVaults[0],
          liquidityAuthority: fx.liquidityAuthorityPda,
          devWalletTokenAccount: fx.devTokenAccounts[0],
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([fx.user, fx.operator])
        .rpc();
    }

    const instance = await fx.program.account.gameInstance.fetch(fx.instancePda);
    expect(instance.insuredTicketsCount).toBe(2);

    const overflowTicketSeed = new BN(2).toArrayLike(Buffer, "le", 8);
    const [overflowTicketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("ticket"), fx.instancePda.toBuffer(), overflowTicketSeed],
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
          user: fx.user.publicKey,
          operator: fx.operator.publicKey,
          payerAuthority: fx.user.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          ticketRecord: overflowTicketPda,
          entryMint: fx.mints[0].publicKey,
          payerEntryTokenAccount: fx.userTokenAccounts[0],
          treasuryVault: fx.treasuryVaultPda,
          globalLiquidityVault: fx.globalLiquidityVaults[0],
          liquidityAuthority: fx.liquidityAuthorityPda,
          devWalletTokenAccount: fx.devTokenAccounts[0],
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([fx.user, fx.operator])
        .rpc()
    ).rejects.toThrow();
  });
});
