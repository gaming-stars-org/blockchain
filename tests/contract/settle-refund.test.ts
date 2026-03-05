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

describe("settle_refund", () => {
  it("refunds insured ticket from global liquidity vault", async () => {
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
        ticketRecord: ticketPda(fx.program.programId, fx.instancePda, 0),
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

    const settlementId = settlementSeed(21);
    await fx.program.methods
      .settleRefund({
        settlementId,
        instanceId: fx.instanceId,
        ticketId: new BN(0),
        beneficiary: fx.user.publicKey,
        refundMint: fx.mints[0].publicKey,
        amount: new BN(fx.ticketPrice),
        resolutionKind: { timeout: {} },
        payloadHash: settlementId,
      } as any)
      .accounts({
        operator: fx.operator.publicKey,
        factoryState: fx.factoryStatePda,
        instance: fx.instancePda,
        ticketRecord: ticketPda(fx.program.programId, fx.instancePda, 0),
        activeEntry: activeEntryPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
        settlementReceipt: settlementReceiptPda(fx.program.programId, 21),
        refundMint: fx.mints[0].publicKey,
        globalLiquidityVault: fx.globalLiquidityVaults[0],
        beneficiaryTokenAccount: fx.userTokenAccounts[0],
        liquidityAuthority: fx.liquidityAuthorityPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([fx.operator])
      .rpc();

    expect(await tokenAmount(fx.client, fx.globalLiquidityVaults[0])).toBe(
      vaultBefore - BigInt(fx.ticketPrice)
    );
    expect(await tokenAmount(fx.client, fx.userTokenAccounts[0])).toBe(
      userBefore + BigInt(fx.ticketPrice)
    );
  });
});
