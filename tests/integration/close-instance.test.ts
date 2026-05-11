import { BN } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  activeEntryPda,
  setupBuyTicketFixture,
  ticketPda,
} from "../helpers/buy-ticket-fixture";

async function setGameOver(fx: any) {
  await fx.program.methods
    .setGameOver()
    .accounts({
      authority: fx.operator.publicKey,
      factoryState: fx.factoryStatePda,
      instance: fx.instancePda,
    } as any)
    .signers([fx.operator])
    .rpc();
}

function makeRecipient(client: any): Keypair {
  const kp = Keypair.generate();
  client.airdrop(kp.publicKey, BigInt(LAMPORTS_PER_SOL));
  return kp;
}

describe("close_instance", () => {
  it("rejects non-operator signer with Unauthorized", async () => {
    const fx = await setupBuyTicketFixture({ acceptedMintsCount: 2 });
    await setGameOver(fx);

    const recipient = makeRecipient(fx.client);

    await expect(
      fx.program.methods
        .closeInstance()
        .accounts({
          authority: fx.owner.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          instanceAuthority: fx.instanceAuthorityPda,
          recipient: recipient.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .remainingAccounts(
          fx.treasuryVaults.map((v: any) => ({
            pubkey: v,
            isSigner: false,
            isWritable: true,
          }))
        )
        .signers([fx.owner])
        .rpc()
    ).rejects.toThrow(/InvalidOperatorCosigner/);
  });

  it("rejects active instance with InstanceNotOver", async () => {
    const fx = await setupBuyTicketFixture({ acceptedMintsCount: 2 });
    const recipient = makeRecipient(fx.client);

    await expect(
      fx.program.methods
        .closeInstance()
        .accounts({
          authority: fx.operator.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          instanceAuthority: fx.instanceAuthorityPda,
          recipient: recipient.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .remainingAccounts(
          fx.treasuryVaults.map((v: any) => ({
            pubkey: v,
            isSigner: false,
            isWritable: true,
          }))
        )
        .signers([fx.operator])
        .rpc()
    ).rejects.toThrow(/InstanceNotOver/);
  });

  it("rejects non-empty treasury vault with TreasuryVaultNotEmpty", async () => {
    const fx = await setupBuyTicketFixture({ acceptedMintsCount: 2 });

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

    await setGameOver(fx);
    const recipient = makeRecipient(fx.client);

    await expect(
      fx.program.methods
        .closeInstance()
        .accounts({
          authority: fx.operator.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          instanceAuthority: fx.instanceAuthorityPda,
          recipient: recipient.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .remainingAccounts(
          fx.treasuryVaults.map((v: any) => ({
            pubkey: v,
            isSigner: false,
            isWritable: true,
          }))
        )
        .signers([fx.operator])
        .rpc()
    ).rejects.toThrow(/TreasuryVaultNotEmpty/);
  });

  it("rejects incomplete treasury vault list with InvalidTreasuryVault", async () => {
    const fx = await setupBuyTicketFixture({ acceptedMintsCount: 2 });
    await setGameOver(fx);

    const recipient = makeRecipient(fx.client);

    await expect(
      fx.program.methods
        .closeInstance()
        .accounts({
          authority: fx.operator.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          instanceAuthority: fx.instanceAuthorityPda,
          recipient: recipient.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .remainingAccounts([
          { pubkey: fx.treasuryVaults[0], isSigner: false, isWritable: true },
        ])
        .signers([fx.operator])
        .rpc()
    ).rejects.toThrow(/InvalidTreasuryVault/);
  });

  it("rejects wrong-order treasury vault list with InvalidTreasuryVault", async () => {
    const fx = await setupBuyTicketFixture({ acceptedMintsCount: 2 });
    await setGameOver(fx);

    const recipient = makeRecipient(fx.client);
    const reversed = [...fx.treasuryVaults].reverse();

    await expect(
      fx.program.methods
        .closeInstance()
        .accounts({
          authority: fx.operator.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
          instanceAuthority: fx.instanceAuthorityPda,
          recipient: recipient.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .remainingAccounts(
          reversed.map((v: any) => ({
            pubkey: v,
            isSigner: false,
            isWritable: true,
          }))
        )
        .signers([fx.operator])
        .rpc()
    ).rejects.toThrow(/InvalidTreasuryVault/);
  });

  it("closes instance and all treasury vaults, forwards rent to recipient", async () => {
    const fx = await setupBuyTicketFixture({ acceptedMintsCount: 2 });
    await setGameOver(fx);

    const recipient = makeRecipient(fx.client);
    const recipientBefore = BigInt(
      fx.client.getAccount(recipient.publicKey)?.lamports ?? 0
    );
    const instanceLamportsBefore = BigInt(
      fx.client.getAccount(fx.instancePda)?.lamports ?? 0
    );
    const vaultLamportsBefore = fx.treasuryVaults.map(
      (v: any) => BigInt(fx.client.getAccount(v)?.lamports ?? 0)
    );
    const expectedDelta =
      instanceLamportsBefore +
      vaultLamportsBefore.reduce((a: bigint, b: bigint) => a + b, BigInt(0));

    await fx.program.methods
      .closeInstance()
      .accounts({
        authority: fx.operator.publicKey,
        factoryState: fx.factoryStatePda,
        instance: fx.instancePda,
        instanceAuthority: fx.instanceAuthorityPda,
        recipient: recipient.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .remainingAccounts(
        fx.treasuryVaults.map((v: any) => ({
          pubkey: v,
          isSigner: false,
          isWritable: true,
        }))
      )
      .signers([fx.operator])
      .rpc();

    expect(fx.client.getAccount(fx.instancePda)).toBeNull();
    for (const vault of fx.treasuryVaults) {
      expect(fx.client.getAccount(vault)).toBeNull();
    }

    const recipientAfter = BigInt(
      fx.client.getAccount(recipient.publicKey)?.lamports ?? 0
    );
    expect(recipientAfter - recipientBefore).toBe(expectedDelta);
  });
});
