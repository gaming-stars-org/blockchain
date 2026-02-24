import { Program } from "@coral-xyz/anchor";
import { fromWorkspace, LiteSVMProvider } from "anchor-litesvm";
import { GamingStars } from "../../target/types/gaming_stars";

const idl = require("../../target/idl/gaming_stars.json");

export function setupLiteSVM() {
  const client = fromWorkspace(".");
  const provider = new LiteSVMProvider(client);
  const program = new Program<GamingStars>(idl, provider);

  return { client, provider, program };
}
