import { Keypair } from "@solana/web3.js";
import { setupBuyTicketFixture } from "../helpers/buy-ticket-fixture";

describe("operator rotation", () => {
  it("rejects old operator after rotation and accepts new operator", async () => {
    const fx = await setupBuyTicketFixture();
    const newOperator = Keypair.generate();
    fx.client.airdrop(newOperator.publicKey, BigInt(1_000_000_000));

    await fx.program.methods
      .updateGlobalWallets({
        newDevWallet: null,
        newMasterWallet: null,
        newOperatorWallet: newOperator.publicKey,
      } as any)
      .accounts({
        owner: fx.owner.publicKey,
        factoryState: fx.factoryStatePda,
      } as any)
      .signers([fx.owner])
      .rpc();

    await expect(
      fx.program.methods
        .setGameOver()
        .accounts({
          authority: fx.operator.publicKey,
          factoryState: fx.factoryStatePda,
          instance: fx.instancePda,
        } as any)
        .signers([fx.operator])
        .rpc()
    ).rejects.toThrow();

    await fx.program.methods
      .setGameOver()
      .accounts({
        authority: newOperator.publicKey,
        factoryState: fx.factoryStatePda,
        instance: fx.instancePda,
      } as any)
      .signers([newOperator])
      .rpc();

    const instance = await fx.program.account.gameInstance.fetch(fx.instancePda);
    expect(Object.keys(instance.status)[0]).toBe("gameOver");
  });
});
