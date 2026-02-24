import { setupLiteSVM } from "./helpers/litesvm-setup";

describe("gaming-stars (LiteSVM)", () => {
  const { program } = setupLiteSVM();

  it("initializes", async () => {
    const tx = await program.methods.initialize().rpc();
    expect(typeof tx).toBe("string");
    expect(tx.length).toBeGreaterThan(0);
  });
});
