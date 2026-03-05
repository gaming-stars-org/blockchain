import { BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  setupBuyTicketFixture,
  ticketPda,
  activeEntryPda,
  tokenAmount,
} from "../helpers/buy-ticket-fixture";

describe("vault initialization", () => {
  it("deploy auto-initializes global liquidity vault PDA and allows topup", async () => {
    const fx = await setupBuyTicketFixture({ acceptedMintsCount: 1 });

    const before = await tokenAmount(fx.client, fx.globalLiquidityVaults[0]);

    await fx.program.methods
      .topupGlobalLiquidity({
        mint: fx.mints[0].publicKey,
        amount: new BN(500),
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

    const after = await tokenAmount(fx.client, fx.globalLiquidityVaults[0]);
    expect(after - before).toBe(BigInt(500));
  });

  it("deploy auto-initializes treasury vault PDA and allows buy_ticket", async () => {
    const fx = await setupBuyTicketFixture({ acceptedMintsCount: 1 });

    const treasuryBefore = await tokenAmount(fx.client, fx.treasuryVaults[0]);

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

    const treasuryAfter = await tokenAmount(fx.client, fx.treasuryVaults[0]);
    expect(treasuryAfter - treasuryBefore).toBe(BigInt(fx.ticketPrice));
  });

  it("allows deploying a second instance with same mint without re-creating GLV", async () => {
    const fx = await setupBuyTicketFixture({ acceptedMintsCount: 1, insuranceMintIndexes: [0] });
    const mint = fx.mints[0].publicKey;
    const glvBefore = await tokenAmount(fx.client, fx.globalLiquidityVaults[0]);

    const instanceId2 = new BN(2);
    const [instancePda2] = PublicKey.findProgramAddressSync(
      [Buffer.from("instance"), instanceId2.toArrayLike(Buffer, "le", 8)],
      fx.program.programId
    );
    const [instanceAuthority2] = PublicKey.findProgramAddressSync(
      [Buffer.from("instance-authority"), instancePda2.toBuffer()],
      fx.program.programId
    );
    const [treasuryVault2] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury-vault"), instancePda2.toBuffer(), mint.toBuffer()],
      fx.program.programId
    );

    await fx.program.methods
      .deployInstance({
        instanceId: instanceId2,
        ticketPrice: new BN(fx.ticketPrice),
        entryFee: new BN(fx.entryFee),
        insurancePremium: new BN(fx.insurancePremium),
        maxInsuredTickets: fx.maxInsuredTickets,
        payoutRatioNum: 2,
        payoutRatioDen: 1,
        gameDurationSecs: new BN(3600),
        userTtlSecs: new BN(300),
        acceptedMints: [mint],
        insuranceMints: [mint],
      } as any)
      .accounts({
        authority: fx.owner.publicKey,
        factoryState: fx.factoryStatePda,
        instance: instancePda2,
        instanceAuthority: instanceAuthority2,
        liquidityAuthority: fx.liquidityAuthorityPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts([
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: treasuryVault2, isSigner: false, isWritable: true },
        { pubkey: fx.globalLiquidityVaults[0], isSigner: false, isWritable: true },
      ])
      .signers([fx.owner])
      .rpc();

    const glvAfter = await tokenAmount(fx.client, fx.globalLiquidityVaults[0]);
    expect(glvAfter).toBe(glvBefore);
  });
});
