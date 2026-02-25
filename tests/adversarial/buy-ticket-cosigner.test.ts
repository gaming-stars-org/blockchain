import { Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { setupBuyTicketFixture, tokenAmount } from "../helpers/buy-ticket-fixture";

describe("buy_ticket operator cosigner checks", () => {
  it("fails when operator signature is missing", async () => {
    const fx = await setupBuyTicketFixture();
    const userBefore = await tokenAmount(fx.client, fx.userTokenAccounts[0]);

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
          ticketRecord: fx.ticketRecordPda,
          entryMint: fx.mints[0].publicKey,
          payerEntryTokenAccount: fx.userTokenAccounts[0],
          treasuryVault: fx.treasuryVaultPda,
          devWalletTokenAccount: fx.devTokenAccounts[0],
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([fx.user])
        .rpc()
    ).rejects.toThrow();

    expect(await tokenAmount(fx.client, fx.userTokenAccounts[0])).toBe(userBefore);
  });

  it("fails when wrong operator signs", async () => {
    const fx = await setupBuyTicketFixture();
    const fakeOperator = Keypair.generate();
    fx.client.airdrop(fakeOperator.publicKey, BigInt(1_000_000_000));

    const userBefore = await tokenAmount(fx.client, fx.userTokenAccounts[0]);

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
          operator: fakeOperator.publicKey,
          payerAuthority: fx.user.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          ticketRecord: fx.ticketRecordPda,
          entryMint: fx.mints[0].publicKey,
          payerEntryTokenAccount: fx.userTokenAccounts[0],
          treasuryVault: fx.treasuryVaultPda,
          devWalletTokenAccount: fx.devTokenAccounts[0],
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([fx.user, fakeOperator])
        .rpc()
    ).rejects.toThrow();

    expect(await tokenAmount(fx.client, fx.userTokenAccounts[0])).toBe(userBefore);
  });
});
