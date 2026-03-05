import { SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import {
  activeEntryPda,
  settlementReceiptPda,
  settlementSeed,
  setupBuyTicketFixture,
  ticketPda,
  tokenAmount,
} from "../helpers/buy-ticket-fixture";

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
        activeEntry: activeEntryPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
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
      .rpc();

    expect(await tokenAmount(fx.client, fx.operatorTokenAccounts[0])).toBe(
      operatorBefore - BigInt(fx.ticketPrice + fx.entryFee)
    );
    expect(await tokenAmount(fx.client, fx.treasuryVaultPda)).toBe(
      treasuryBefore + BigInt(fx.ticketPrice)
    );
  });

  it("blocks a second active ticket and clears active entry on settlement", async () => {
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

    const secondBuy = fx.program.methods
        .buyTicket({
          entryMode: { paid: {} },
          entryMint: fx.mints[1].publicKey,
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
          ticketRecord: ticketPda(fx.program.programId, fx.instancePda, 1),
          activeEntry: activeEntryPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
          entryMint: fx.mints[1].publicKey,
          payerEntryTokenAccount: fx.userTokenAccounts[1],
          treasuryVault: fx.treasuryVaults[1],
          globalLiquidityVault: fx.globalLiquidityVaults[1],
          liquidityAuthority: fx.liquidityAuthorityPda,
          devWalletTokenAccount: fx.devTokenAccounts[1],
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([fx.user, fx.operator])
        .rpc();
    await expect(secondBuy).rejects.toBeDefined();

    const sid = settlementSeed(91);
    await fx.program.methods
      .settleForfeit({
        settlementId: sid,
        instanceId: fx.instanceId,
        ticketId: new BN(0),
        legs: [
          {
            mint: fx.mints[0].publicKey,
            amount: new BN(fx.ticketPrice),
            sourceVault: fx.treasuryVaults[0],
            destinationAta: fx.devTokenAccounts[0],
          },
        ],
        resolutionKind: { loss: {} },
        payloadHash: sid,
      } as any)
      .accounts({
        operator: fx.operator.publicKey,
        factoryState: fx.factoryStatePda,
        instance: fx.instancePda,
        ticketRecord: ticketPda(fx.program.programId, fx.instancePda, 0),
        activeEntry: activeEntryPda(fx.program.programId, fx.instancePda, fx.user.publicKey),
        settlementReceipt: settlementReceiptPda(fx.program.programId, 91),
        instanceAuthority: fx.instanceAuthorityPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts([
        { pubkey: fx.mints[0].publicKey, isSigner: false, isWritable: false },
        { pubkey: fx.treasuryVaults[0], isSigner: false, isWritable: true },
        { pubkey: fx.devTokenAccounts[0], isSigner: false, isWritable: true },
      ])
      .signers([fx.operator])
      .rpc();

    const activeEntryAccount = fx.client.getAccount(
      activeEntryPda(fx.program.programId, fx.instancePda, fx.user.publicKey)
    );
    expect(activeEntryAccount).toBeNull();
  });
});
