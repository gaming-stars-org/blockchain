import { SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import {
  activeEntryPda,
  setupBuyTicketFixture,
  tokenAmount,
} from "../helpers/buy-ticket-fixture";

describe("buy_ticket sponsored and payer validation", () => {
  it("rejects sponsored + insured", async () => {
    const fx = await setupBuyTicketFixture();
    const operatorBefore = await tokenAmount(fx.client, fx.operatorTokenAccounts[0]);

    await expect(
      fx.program.methods
        .buyTicket({
          entryMode: { sponsored: {} },
          entryMint: fx.mints[0].publicKey,
          insured: true,
          entryTotalAmount: new BN(fx.ticketPrice + fx.entryFee + fx.insurancePremium),
          insurancePremiumAmount: new BN(fx.insurancePremium),
          externalRef: null,
        } as any)
        .accounts({
          user: fx.user.publicKey,
          operator: fx.operator.publicKey,
          payerAuthority: fx.operator.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          ticketRecord: fx.ticketRecordPda,
          activeEntry: activeEntryPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
          entryMint: fx.mints[0].publicKey,
          payerEntryTokenAccount: fx.operatorTokenAccounts[0],
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

    expect(await tokenAmount(fx.client, fx.operatorTokenAccounts[0])).toBe(operatorBefore);
  });

  it("rejects paid mode when payer authority is not user", async () => {
    const fx = await setupBuyTicketFixture();

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
          payerAuthority: fx.operator.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          ticketRecord: fx.ticketRecordPda,
          activeEntry: activeEntryPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
          entryMint: fx.mints[0].publicKey,
          payerEntryTokenAccount: fx.operatorTokenAccounts[0],
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
