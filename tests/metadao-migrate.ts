import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MetadaoMigrate } from "../target/types/metadao_migrate";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createInitializeMint2Instruction, createMintToInstruction, getAssociatedTokenAddressSync, getMinimumBalanceForRentExemptMint, MINT_SIZE } from "@solana/spl-token";
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";

describe("metadao-migrate", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider();

  const connection = provider.connection;

  const confirm = async (signature: string): Promise<string> => {
    const block = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature,
      ...block,
    });
    return signature;
  };

  const log = async (signature: string): Promise<string> => {
    console.log(
      `Your transaction signature: https://explorer.solana.com/transaction/${signature}?cluster=custom&customUrl=${connection.rpcEndpoint}`
    );
    return signature;
  };

  const program = anchor.workspace.metadaoMigrate as Program<MetadaoMigrate>;

  // Keypairs
  const adminKeypair = Keypair.fromSecretKey(Buffer.from([43,182,163,103,250,96,247,91,148,97,186,135,195,109,88,179,78,154,208,26,84,200,152,169,150,202,177,221,63,127,124,216,10,53,54,52,183,43,193,107,225,166,65,186,61,252,142,48,101,62,82,135,33,183,247,53,162,9,225,183,10,99,130,165]));
  const mintFromKeypair = Keypair.generate();
  const mintToKeypair = Keypair.generate();
  const payerKeypair = Keypair.generate()

  // Addresses
  const admin = adminKeypair.publicKey; // gr8zGEubscQFgPQ5srfFJg4HRVo2zVFm8YV4CRcFYp4
  const mintFrom = mintFromKeypair.publicKey;
  const mintTo = mintToKeypair.publicKey;
  const payer = payerKeypair.publicKey;

  // Programs
  const tokenProgram = TOKEN_PROGRAM_ID;
  const systemProgram = SYSTEM_PROGRAM_ID;

  // Config
  const config = PublicKey.findProgramAddressSync([Buffer.from("migration"), mintFrom.toBuffer(), mintTo.toBuffer()].concat(), program.programId)[0];

  // Token Accounts
  const [payerTaFrom, payerTaTo, configTaFrom, configTaTo] = [
        getAssociatedTokenAddressSync(mintFrom, payer, false, tokenProgram),
        getAssociatedTokenAddressSync(mintTo, payer, false, tokenProgram),
        getAssociatedTokenAddressSync(mintFrom, config, true, tokenProgram),
        getAssociatedTokenAddressSync(mintTo, config, true, tokenProgram)
  ];

  const accounts = {
    admin,
    config,
    mintFrom,
    mintTo,
    payer,
    payerTaFrom,
    payerTaTo,
    configTaFrom,
    configTaTo,
    tokenProgram,
    systemProgram
  }

  it("Airdrop", async () => {
    let lamports = await getMinimumBalanceForRentExemptMint(connection);
    let tx = new Transaction();
    tx.instructions = [
      ...[admin, payer].map((account) =>
        SystemProgram.transfer({
          fromPubkey: provider.publicKey,
          toPubkey: account,
          lamports: 10 * LAMPORTS_PER_SOL,
        })
      ),
      ...[mintFrom, mintTo].map((mint) =>
        SystemProgram.createAccount({
          fromPubkey: provider.publicKey,
          newAccountPubkey: mint,
          lamports,
          space: MINT_SIZE,
          programId: tokenProgram,
        })
      ),
      createInitializeMint2Instruction(mintFrom, 6, provider.publicKey!, null, tokenProgram),
      createInitializeMint2Instruction(mintTo, 6, provider.publicKey!, null, tokenProgram),
      ...[
        { mint: mintFrom, authority: payer, ata: payerTaFrom },
        { mint: mintTo, authority: payer, ata: payerTaTo },
        { mint: mintFrom, authority: config, ata: configTaFrom },
        { mint: mintTo, authority: config, ata: configTaTo },
      ]
      .flatMap((account) => [
        createAssociatedTokenAccountIdempotentInstruction(provider.publicKey, account.ata, account.authority, account.mint, tokenProgram),
        createMintToInstruction(account.mint, account.ata, account.authority, 1e9, undefined, tokenProgram),
      ])
    ];

    console.log(accounts);

    await provider.sendAndConfirm(tx, [mintFromKeypair, mintToKeypair]).then(log);
  })

  it("Initialize", async () => {
    // Add your test here.
    const tx = await program.methods.initialize(
      mintFrom,
      mintTo,
      { fixed: { 0: 0 } }
    )
    .accountsStrict({
      ...accounts
    })
    .signers([adminKeypair])
    .rpc()
    .then(confirm)
    .then(log);
  });
});
