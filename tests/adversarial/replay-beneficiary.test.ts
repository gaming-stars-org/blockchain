import { BN } from "@coral-xyz/anchor";
import { Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  settlementReceiptPda,
  settlementSeed,
  setupBuyTicketFixture,
  ticketPda,
} from "../helpers/buy-ticket-fixture";

describe("replay and beneficiary guards", () => {
  it("rejects replayed settlement id", async () => {
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
        globalLiquidityVault: fx.globalLiquidityVaults[0],
        liquidityAuthority: fx.liquidityAuthorityPda,
        devWalletTokenAccount: fx.devTokenAccounts[0],
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([fx.user, fx.operator])
      .rpc();

    const sid = settlementSeed(51);
    const payoutArgs = {
      settlementId: sid,
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
      payloadHash: sid,
    } as any;

    await fx.program.methods
      .settlePayout(payoutArgs)
      .accounts({
        operator: fx.operator.publicKey,
        factoryState: fx.factoryStatePda,
        instance: fx.instancePda,
        ticketRecord: ticketPda(fx.program.programId, fx.instancePda, 0),
        settlementReceipt: settlementReceiptPda(fx.program.programId, 51),
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
      .rpc();

    await expect(
      fx.program.methods
        .settlePayout(payoutArgs)
        .accounts({
          operator: fx.operator.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          ticketRecord: ticketPda(fx.program.programId, fx.instancePda, 0),
          settlementReceipt: settlementReceiptPda(fx.program.programId, 51),
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
  });

  it("rejects beneficiary mismatch", async () => {
    const fx = await setupBuyTicketFixture();
    const wrongUser = Keypair.generate();
    fx.client.airdrop(wrongUser.publicKey, BigInt(1_000_000_000));

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
        globalLiquidityVault: fx.globalLiquidityVaults[0],
        liquidityAuthority: fx.liquidityAuthorityPda,
        devWalletTokenAccount: fx.devTokenAccounts[0],
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([fx.user, fx.operator])
      .rpc();

    const sid = settlementSeed(52);
    await expect(
      fx.program.methods
        .settlePayout({
          settlementId: sid,
          instanceId: fx.instanceId,
          ticketId: new BN(0),
          beneficiary: wrongUser.publicKey,
          legs: [
            {
              mint: fx.mints[0].publicKey,
              amount: new BN(fx.ticketPrice),
              sourceVault: fx.treasuryVaults[0],
              destinationAta: fx.userTokenAccounts[0],
            },
          ],
          resolutionKind: { win: {} },
          payloadHash: sid,
        } as any)
        .accounts({
          operator: fx.operator.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          ticketRecord: ticketPda(fx.program.programId, fx.instancePda, 0),
          settlementReceipt: settlementReceiptPda(fx.program.programId, 52),
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
  });
});
