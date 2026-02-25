import { setupLiteSVM } from "./helpers/litesvm-setup";

describe("gaming-stars (LiteSVM)", () => {
  const { program } = setupLiteSVM();

  it("exports foundation instructions", () => {
    expect(program.methods.initializeFactory).toBeDefined();
    expect(program.methods.deployInstance).toBeDefined();
    expect(program.methods.freezeInstance).toBeDefined();
    expect(program.methods.buyTicket).toBeDefined();
  });
});
