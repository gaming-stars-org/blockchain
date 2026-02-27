import { BN } from "@coral-xyz/anchor";
import { SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  settlementReceiptPda,
  settlementSeed,
  setupBuyTicketFixture,
  ticketPda,
} from "../helpers/buy-ticket-fixture";

describe("settle_refund dual mint", () => {
  it("supports refunds from both configured insurance mints", async () => {
    const fx = await setupBuyTicketFixture({ insuranceMintIndexes: [0, 1] });

    for (const mintIndex of [0, 1]) {
      const ticketId = mintIndex;

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
          user: fx.user.publicKey,
          operator: fx.operator.publicKey,
          payerAuthority: fx.user.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          ticketRecord: ticketPda(fx.program.programId, fx.instancePda, ticketId),
          entryMint: fx.mints[mintIndex].publicKey,
          payerEntryTokenAccount: fx.userTokenAccounts[mintIndex],
          treasuryVault: fx.treasuryVaults[mintIndex],
          globalLiquidityVault: fx.globalLiquidityVaults[mintIndex],
          liquidityAuthority: fx.liquidityAuthorityPda,
          devWalletTokenAccount: fx.devTokenAccounts[mintIndex],
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([fx.user, fx.operator])
        .rpc();

      await fx.program.methods
        .topupGlobalLiquidity({
          mint: fx.mints[mintIndex].publicKey,
          amount: new BN(1_000),
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

      const sid = 31 + mintIndex;
      const settlementId = settlementSeed(sid);
      await fx.program.methods
        .settleRefund({
          settlementId,
          instanceId: fx.instanceId,
          ticketId: new BN(ticketId),
          beneficiary: fx.user.publicKey,
          refundMint: fx.mints[mintIndex].publicKey,
          amount: new BN(fx.ticketPrice),
          resolutionKind: { timeout: {} },
          payloadHash: settlementId,
        } as any)
        .accounts({
          operator: fx.operator.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          ticketRecord: ticketPda(fx.program.programId, fx.instancePda, ticketId),
          settlementReceipt: settlementReceiptPda(fx.program.programId, sid),
          refundMint: fx.mints[mintIndex].publicKey,
          globalLiquidityVault: fx.globalLiquidityVaults[mintIndex],
          beneficiaryTokenAccount: fx.userTokenAccounts[mintIndex],
          liquidityAuthority: fx.liquidityAuthorityPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([fx.operator])
        .rpc();
    }
  });
});
