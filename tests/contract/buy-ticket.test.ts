import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { setupBuyTicketFixture, tokenAmount } from "../helpers/buy-ticket-fixture";

describe("buy_ticket happy path", () => {
  it("paid entry splits principal and fee", async () => {
    const fx = await setupBuyTicketFixture();

    const userBefore = await tokenAmount(fx.client, fx.userTokenAccounts[0]);
    const treasuryBefore = await tokenAmount(fx.client, fx.treasuryVaultPda);
    const devBefore = await tokenAmount(fx.client, fx.devTokenAccounts[0]);

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
        ticketRecord: fx.ticketRecordPda,
        entryMint: fx.mints[0].publicKey,
        payerEntryTokenAccount: fx.userTokenAccounts[0],
        treasuryVault: fx.treasuryVaultPda,
        devWalletTokenAccount: fx.devTokenAccounts[0],
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([fx.user, fx.operator])
      .rpc();

    expect(await tokenAmount(fx.client, fx.userTokenAccounts[0])).toBe(
      userBefore - BigInt(fx.ticketPrice + fx.entryFee)
    );
    expect(await tokenAmount(fx.client, fx.treasuryVaultPda)).toBe(
      treasuryBefore + BigInt(fx.ticketPrice)
    );
    expect(await tokenAmount(fx.client, fx.devTokenAccounts[0])).toBe(
      devBefore + BigInt(fx.entryFee)
    );
  });

  it("sponsored entry charges operator payer", async () => {
    const fx = await setupBuyTicketFixture();

    const operatorBefore = await tokenAmount(fx.client, fx.operatorTokenAccounts[0]);
    const treasuryBefore = await tokenAmount(fx.client, fx.treasuryVaultPda);

    await fx.program.methods
      .buyTicket({
        entryMode: { sponsored: {} },
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
        entryMint: fx.mints[0].publicKey,
        payerEntryTokenAccount: fx.operatorTokenAccounts[0],
        treasuryVault: fx.treasuryVaultPda,
        devWalletTokenAccount: fx.devTokenAccounts[0],
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([fx.user, fx.operator])
      .rpc();

    expect(await tokenAmount(fx.client, fx.operatorTokenAccounts[0])).toBe(
      operatorBefore - BigInt(fx.ticketPrice + fx.entryFee)
    );
    expect(await tokenAmount(fx.client, fx.treasuryVaultPda)).toBe(
      treasuryBefore + BigInt(fx.ticketPrice)
    );
  });
});
