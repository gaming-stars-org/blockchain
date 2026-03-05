import { Program, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  AccountLayout,
  AccountState,
  ACCOUNT_SIZE,
  MintLayout,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { setupLiteSVM } from "./litesvm-setup";
import { GamingStars } from "../../target/types/gaming_stars";

const ZERO_PUBKEY = new PublicKey(new Uint8Array(32));

function u64le(value: BN | number): Buffer {
  const bn = BN.isBN(value) ? value : new BN(value);
  return bn.toArrayLike(Buffer, "le", 8);
}

type FixtureConfig = {
  ticketPrice?: number;
  entryFee?: number;
  insurancePremium?: number;
  maxInsuredTickets?: number;
  acceptedMintsCount?: number;
  insuranceMintIndexes?: number[];
};

export type BuyTicketFixture = {
  program: Program<GamingStars>;
  client: any;
  owner: Keypair;
  operator: Keypair;
  devWallet: Keypair;
  masterWallet: Keypair;
  user: Keypair;
  payerOperator: Keypair;
  factoryStatePda: PublicKey;
  instancePda: PublicKey;
  instanceAuthorityPda: PublicKey;
  liquidityAuthorityPda: PublicKey;
  treasuryVaultPda: PublicKey;
  treasuryVaults: PublicKey[];
  globalLiquidityVaults: PublicKey[];
  ticketRecordPda: PublicKey;
  activeEntryPda: PublicKey;
  mints: Keypair[];
  masterTokenAccounts: PublicKey[];
  userTokenAccounts: PublicKey[];
  operatorTokenAccounts: PublicKey[];
  devTokenAccounts: PublicKey[];
  ticketPrice: number;
  entryFee: number;
  insurancePremium: number;
  maxInsuredTickets: number;
  instanceId: BN;
};

export async function setupBuyTicketFixture(
  config: FixtureConfig = {}
): Promise<BuyTicketFixture> {
  const { program, client, provider } = setupLiteSVM();

  const owner = (provider.wallet as any).payer as Keypair;
  const operator = Keypair.generate();
  const devWallet = Keypair.generate();
  const masterWallet = Keypair.generate();
  const user = Keypair.generate();
  const payerOperator = operator;

  [operator, devWallet, masterWallet, user].forEach((kp) => {
    client.airdrop(kp.publicKey, BigInt(10 * LAMPORTS_PER_SOL));
  });

  const ticketPrice = config.ticketPrice ?? 900;
  const entryFee = config.entryFee ?? 100;
  const insurancePremium = config.insurancePremium ?? 50;
  const maxInsuredTickets = config.maxInsuredTickets ?? 2;
  const instanceId = new BN(1);

  const [factoryStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("factory-state")],
    program.programId
  );

  await program.methods
    .initializeFactory(devWallet.publicKey, masterWallet.publicKey, operator.publicKey)
    .accounts({
      owner: owner.publicKey,
      factoryState: factoryStatePda,
      systemProgram: SystemProgram.programId,
    } as any)
    .signers([owner])
    .rpc();

  const [instancePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("instance"), u64le(instanceId)],
    program.programId
  );

  const mintCount = config.acceptedMintsCount ?? 2;
  const mints = Array.from({ length: mintCount }, () => Keypair.generate());

  const insuranceMintIndexes = config.insuranceMintIndexes ?? [0, 1].filter((i) => i < mintCount);
  const acceptedMints = mints.map((m) => m.publicKey);
  const insuranceMints = insuranceMintIndexes.map((i) => mints[i].publicKey);

  const [instanceAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("instance-authority"), instancePda.toBuffer()],
    program.programId
  );
  const [liquidityAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("liquidity-authority")],
    program.programId
  );
  const treasuryVaults = mints.map((mint) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("treasury-vault"), instancePda.toBuffer(), mint.publicKey.toBuffer()],
      program.programId
    )[0]
  );
  const treasuryVaultPda = treasuryVaults[0];
  const globalLiquidityVaults = mints.map((mint) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("global-liquidity-vault"), mint.publicKey.toBuffer()],
      program.programId
    )[0]
  );

  for (const mint of mints) {
    setMintAccount(client, mint.publicKey, owner.publicKey, 6, BigInt(10_000_000));
  }

  await program.methods
    .deployInstance({
      instanceId: instanceId,
      ticketPrice: new BN(ticketPrice),
      entryFee: new BN(entryFee),
      insurancePremium: new BN(insurancePremium),
      maxInsuredTickets: maxInsuredTickets,
      payoutRatioNum: 2,
      payoutRatioDen: 1,
      gameDurationSecs: new BN(3600),
      userTtlSecs: new BN(300),
      acceptedMints: acceptedMints,
      insuranceMints: insuranceMints,
    } as any)
    .accounts({
      authority: owner.publicKey,
      factoryState: factoryStatePda,
      instance: instancePda,
      instanceAuthority: instanceAuthorityPda,
      liquidityAuthority: liquidityAuthorityPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    } as any)
    .remainingAccounts(
      mints.flatMap((mint, i) => [
        { pubkey: mint.publicKey, isSigner: false, isWritable: false },
        { pubkey: treasuryVaults[i], isSigner: false, isWritable: true },
        { pubkey: globalLiquidityVaults[i], isSigner: false, isWritable: true },
      ])
    )
    .signers([owner])
    .rpc();

  const [ticketRecordPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("ticket"), instancePda.toBuffer(), u64le(0)],
    program.programId
  );
  const [activeEntryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("active-entry"), instancePda.toBuffer(), user.publicKey.toBuffer()],
    program.programId
  );

  const masterTokenAccounts: PublicKey[] = [];
  const userTokenAccounts: PublicKey[] = [];
  const operatorTokenAccounts: PublicKey[] = [];
  const devTokenAccounts: PublicKey[] = [];

  for (const [i, mint] of mints.entries()) {
    const masterAta = Keypair.generate().publicKey;
    const userAta = Keypair.generate().publicKey;
    const operatorAta = Keypair.generate().publicKey;
    const devAta = Keypair.generate().publicKey;

    setTokenAccount(client, masterAta, mint.publicKey, masterWallet.publicKey, BigInt(3_000_000));
    setTokenAccount(client, userAta, mint.publicKey, user.publicKey, BigInt(2_000_000));
    setTokenAccount(client, operatorAta, mint.publicKey, operator.publicKey, BigInt(2_000_000));
    setTokenAccount(client, devAta, mint.publicKey, devWallet.publicKey, BigInt(0));
    masterTokenAccounts.push(masterAta);
    userTokenAccounts.push(userAta);
    operatorTokenAccounts.push(operatorAta);
    devTokenAccounts.push(devAta);
  }

  return {
    program,
    client,
    owner,
    operator,
    devWallet,
    masterWallet,
    user,
    payerOperator,
    factoryStatePda,
    instancePda,
    instanceAuthorityPda,
    liquidityAuthorityPda,
    treasuryVaultPda,
    treasuryVaults,
    globalLiquidityVaults,
    ticketRecordPda,
    activeEntryPda,
    mints,
    masterTokenAccounts,
    userTokenAccounts,
    operatorTokenAccounts,
    devTokenAccounts,
    ticketPrice,
    entryFee,
    insurancePremium,
    maxInsuredTickets,
    instanceId,
  };
}

export async function tokenAmount(client: any, tokenAccount: PublicKey): Promise<bigint> {
  const acc = client.getAccount(tokenAccount);
  if (!acc) {
    throw new Error(`Token account ${tokenAccount.toBase58()} missing`);
  }
  const raw = AccountLayout.decode(Buffer.from(acc.data));
  return raw.amount as bigint;
}

export function ticketPda(programId: PublicKey, instance: PublicKey, ticketId: number): PublicKey {
  const ticketSeed = new BN(ticketId).toArrayLike(Buffer, "le", 8);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("ticket"), instance.toBuffer(), ticketSeed],
    programId
  )[0];
}

export function activeEntryPda(programId: PublicKey, instance: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("active-entry"), instance.toBuffer(), owner.toBuffer()],
    programId
  )[0];
}

export function settlementReceiptPda(programId: PublicKey, settlementId: number): PublicKey {
  const settlementSeed = Buffer.alloc(32);
  settlementSeed[0] = settlementId;
  return PublicKey.findProgramAddressSync(
    [Buffer.from("settlement"), settlementSeed],
    programId
  )[0];
}

export function settlementSeed(id: number): number[] {
  const seed = Buffer.alloc(32);
  seed[0] = id;
  return Array.from(seed);
}

function setMintAccount(
  client: any,
  mint: PublicKey,
  mintAuthority: PublicKey,
  decimals: number,
  supply: bigint
) {
  const data = Buffer.alloc(MINT_SIZE);
  MintLayout.encode(
    {
      mintAuthorityOption: 1,
      mintAuthority,
      supply,
      decimals,
      isInitialized: true,
      freezeAuthorityOption: 0,
      freezeAuthority: ZERO_PUBKEY,
    },
    data
  );

  client.setAccount(mint, {
    lamports: Number(client.minimumBalanceForRentExemption(BigInt(MINT_SIZE))),
    data: new Uint8Array(data),
    owner: TOKEN_PROGRAM_ID,
    executable: false,
    rentEpoch: 0,
  });
}

function setTokenAccount(
  client: any,
  address: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  amount: bigint
) {
  const data = Buffer.alloc(ACCOUNT_SIZE);
  AccountLayout.encode(
    {
      mint,
      owner,
      amount,
      delegateOption: 0,
      delegate: ZERO_PUBKEY,
      state: AccountState.Initialized,
      isNativeOption: 0,
      isNative: BigInt(0),
      delegatedAmount: BigInt(0),
      closeAuthorityOption: 0,
      closeAuthority: ZERO_PUBKEY,
    },
    data
  );

  client.setAccount(address, {
    lamports: Number(client.minimumBalanceForRentExemption(BigInt(ACCOUNT_SIZE))),
    data: new Uint8Array(data),
    owner: TOKEN_PROGRAM_ID,
    executable: false,
    rentEpoch: 0,
  });
}
