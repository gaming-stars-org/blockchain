import { BN } from "@coral-xyz/anchor";
import { SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  setupBuyTicketFixture,
  settlementSeed,
  settlementReceiptPda,
  ticketPda,
  activeEntryPda,
  tokenAmount,
} from "../helpers/buy-ticket-fixture";

describe("settle_users_batch", () => {
  it("executes payout/forfeit items and rejects duplicate settlement ids", async () => {
    const fx = await setupBuyTicketFixture({ insuranceMintIndexes: [0, 1] });

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

    const treasuryBefore = await tokenAmount(fx.client, fx.treasuryVaults[0]);
    const user0Before = await tokenAmount(fx.client, fx.userTokenAccounts[0]);

    await fx.program.methods
      .settleUsersBatch({
        instanceId: fx.instanceId,
        items: [
          {
            settlementId: settlementSeed(61),
            ticketId: new BN(0),
            owner: fx.user.publicKey,
            kind: { payout: {} },
            beneficiary: fx.user.publicKey,
            refundMint: null,
            refundAmount: null,
            legs: [
              {
                mint: fx.mints[0].publicKey,
                amount: new BN(fx.ticketPrice),
                sourceVault: fx.treasuryVaults[0],
                destinationAta: fx.userTokenAccounts[0],
              },
            ],
            resolutionKind: { win: {} },
            payloadHash: settlementSeed(61),
          },
        ],
      } as any)
      .accounts({
        operator: fx.operator.publicKey,
        factoryState: fx.factoryStatePda,
        instance: fx.instancePda,
        instanceAuthority: fx.instanceAuthorityPda,
        liquidityAuthority: fx.liquidityAuthorityPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts([
        { pubkey: ticketPda(fx.program.programId, fx.instancePda, fx.user.publicKey), isSigner: false, isWritable: true },
        { pubkey: settlementReceiptPda(fx.program.programId, 61), isSigner: false, isWritable: true },
        {
          pubkey: activeEntryPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
          isSigner: false,
          isWritable: true,
        },
        { pubkey: fx.mints[0].publicKey, isSigner: false, isWritable: false },
        { pubkey: fx.treasuryVaults[0], isSigner: false, isWritable: true },
        { pubkey: fx.userTokenAccounts[0], isSigner: false, isWritable: true },
      ])
      .signers([fx.operator])
      .rpc();

    expect(await tokenAmount(fx.client, fx.treasuryVaults[0])).toBe(
      treasuryBefore - BigInt(fx.ticketPrice)
    );
    expect(await tokenAmount(fx.client, fx.userTokenAccounts[0])).toBe(
      user0Before + BigInt(fx.ticketPrice)
    );

    // ticket_record is closed on settlement — verify it no longer exists
    const ticket0Account = fx.client.getAccount(
      ticketPda(fx.program.programId, fx.instancePda, fx.user.publicKey)
    );
    expect(ticket0Account).toBeNull();

    await expect(
      fx.program.methods
        .settleUsersBatch({
          instanceId: fx.instanceId,
          items: [
            {
              settlementId: settlementSeed(71),
              ticketId: new BN(0),
              owner: fx.user.publicKey,
              kind: { payout: {} },
              beneficiary: fx.user.publicKey,
              refundMint: null,
              refundAmount: null,
              legs: [
                {
                  mint: fx.mints[0].publicKey,
                  amount: new BN(1),
                  sourceVault: fx.treasuryVaults[0],
                  destinationAta: fx.userTokenAccounts[0],
                },
              ],
              resolutionKind: { win: {} },
              payloadHash: settlementSeed(71),
            },
            {
              settlementId: settlementSeed(71),
              ticketId: new BN(1),
              owner: fx.user.publicKey,
              kind: { forfeit: {} },
              beneficiary: null,
              refundMint: null,
              refundAmount: null,
              legs: [
                {
                  mint: fx.mints[1].publicKey,
                  amount: new BN(1),
                  sourceVault: fx.treasuryVaults[1],
                  destinationAta: fx.devTokenAccounts[1],
                },
              ],
              resolutionKind: { loss: {} },
              payloadHash: settlementSeed(71),
            },
          ],
        } as any)
        .accounts({
          operator: fx.operator.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          instanceAuthority: fx.instanceAuthorityPda,
          liquidityAuthority: fx.liquidityAuthorityPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([fx.operator])
        .rpc()
    ).rejects.toThrow();
  });
});
