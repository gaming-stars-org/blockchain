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

describe("settle_payout", () => {
  it("moves treasury funds across multiple legs and writes receipt", async () => {
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
          ticketRecord: ticketPda(fx.program.programId, fx.instancePda, mintIndex),
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

    const treasury0Before = await tokenAmount(fx.client, fx.treasuryVaults[0]);
    const treasury1Before = await tokenAmount(fx.client, fx.treasuryVaults[1]);
    const beneficiary0Before = await tokenAmount(fx.client, fx.userTokenAccounts[0]);
    const beneficiary1Before = await tokenAmount(fx.client, fx.userTokenAccounts[1]);

    const settlementId = settlementSeed(11);
    await fx.program.methods
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
          {
            mint: fx.mints[1].publicKey,
            amount: new BN(fx.ticketPrice),
            sourceVault: fx.treasuryVaults[1],
            destinationAta: fx.userTokenAccounts[1],
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
        activeEntry: activeEntryPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
        settlementReceipt: settlementReceiptPda(fx.program.programId, 11),
        instanceAuthority: fx.instanceAuthorityPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts([
        { pubkey: fx.mints[0].publicKey, isSigner: false, isWritable: false },
        { pubkey: fx.treasuryVaults[0], isSigner: false, isWritable: true },
        { pubkey: fx.userTokenAccounts[0], isSigner: false, isWritable: true },
        { pubkey: fx.mints[1].publicKey, isSigner: false, isWritable: false },
        { pubkey: fx.treasuryVaults[1], isSigner: false, isWritable: true },
        { pubkey: fx.userTokenAccounts[1], isSigner: false, isWritable: true },
      ])
      .signers([fx.operator])
      .rpc();

    expect(await tokenAmount(fx.client, fx.treasuryVaults[0])).toBe(
      treasury0Before - BigInt(fx.ticketPrice)
    );
    expect(await tokenAmount(fx.client, fx.treasuryVaults[1])).toBe(
      treasury1Before - BigInt(fx.ticketPrice)
    );
    expect(await tokenAmount(fx.client, fx.userTokenAccounts[0])).toBe(
      beneficiary0Before + BigInt(fx.ticketPrice)
    );
    expect(await tokenAmount(fx.client, fx.userTokenAccounts[1])).toBe(
      beneficiary1Before + BigInt(fx.ticketPrice)
    );

    const ticket = await fx.program.account.ticketRecord.fetch(
      ticketPda(fx.program.programId, fx.instancePda, 0)
    );
    expect(Object.keys(ticket.status)[0]).toBe("paid");
  });
});
