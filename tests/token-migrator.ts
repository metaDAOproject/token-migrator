import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenMigrator } from "../target/types/token_migrator";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createInitializeMint2Instruction, createMintToInstruction, getAssociatedTokenAddressSync, getMinimumBalanceForRentExemptMint, MINT_SIZE, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "bn.js";

describe("token-migrator", () => {
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
      `✅ Your transaction signature: https://explorer.solana.com/transaction/${signature}?cluster=custom&customUrl=${connection.rpcEndpoint}`
    );
    return signature;
  };

  const program = anchor.workspace.tokenMigrator as Program<TokenMigrator>;

  // Keypairs
  // ⚠️ WARNING: Do not use admin keypair in production!
  const adminKeypair = Keypair.fromSecretKey(Buffer.from([43, 182, 163, 103, 250, 96, 247, 91, 148, 97, 186, 135, 195, 109, 88, 179, 78, 154, 208, 26, 84, 200, 152, 169, 150, 202, 177, 221, 63, 127, 124, 216, 10, 53, 54, 52, 183, 43, 193, 107, 225, 166, 65, 186, 61, 252, 142, 48, 101, 62, 82, 135, 33, 183, 247, 53, 162, 9, 225, 183, 10, 99, 130, 165]));
  const userKeypair = Keypair.generate()
  const mintFromKeypair = Keypair.generate();
  const mintToKeypair = Keypair.generate();

  // Addresses
  // ⚠️ WARNING: Do not use admin address in production!
  const admin = adminKeypair.publicKey; // gr8zGEubscQFgPQ5srfFJg4HRVo2zVFm8YV4CRcFYp4
  const user = userKeypair.publicKey;

  // Mints
  const mintFrom = mintFromKeypair.publicKey;
  const mintTo = mintToKeypair.publicKey;

  // Programs
  const systemProgram = SystemProgram.programId;
  const tokenProgram = TOKEN_PROGRAM_ID;

  // Vault
  const vault = PublicKey.findProgramAddressSync([Buffer.from("vault"), admin.toBuffer(), mintFrom.toBuffer(), mintTo.toBuffer()].concat(), program.programId)[0];

  // Token Accounts
  const [userFromTa, userToTa, vaultFromAta, vaultToAta] = [
    getAssociatedTokenAddressSync(mintFrom, user, false),
    getAssociatedTokenAddressSync(mintTo, user, false),
    getAssociatedTokenAddressSync(mintFrom, vault, true),
    getAssociatedTokenAddressSync(mintTo, vault, true)
  ];

  const accounts = {
    admin,
    mintFrom,
    mintTo,
    user,
    userFromTa,
    userToTa,
    vault,
    vaultFromAta,
    vaultToAta,
    tokenProgram,
    systemProgram
  }

  describe('Account Setup', async () => {
    it("Airdrops 10 SOL to our `admin` and `user` accounts. Initializes `mintFrom` and `mintTo` token mints. Initializes `userFromTa` and funds it with 1B microtokens.", async () => {
      let lamports = await getMinimumBalanceForRentExemptMint(connection);
      let tx = new Transaction();
      tx.instructions = [
        ...[admin, user].map((account) =>
          SystemProgram.transfer({
            fromPubkey: provider.publicKey,
            toPubkey: account,
            lamports: 10 * LAMPORTS_PER_SOL,
          })
        ),
        ...[mintFrom, mintTo].flatMap((mint) =>
          [
            SystemProgram.createAccount({
              fromPubkey: provider.publicKey,
              newAccountPubkey: mint,
              lamports,
              space: MINT_SIZE,
              programId: tokenProgram,
            }),
            createInitializeMint2Instruction(mint, 6, provider.publicKey!, null),
          ]
        ),
        createAssociatedTokenAccountIdempotentInstruction(provider.publicKey, userFromTa, user, mintFrom),
        createMintToInstruction(mintFrom, userFromTa, provider.publicKey!, 1e9),
      ];

      await provider.sendAndConfirm(tx, [mintFromKeypair, mintToKeypair]).then(log);
    })
  })

  describe('Initialize', async () => {
    it("Initializes a new token migration. Ensures both `vaultFromAta` and `vaultToAta` are created in our `preInstructions` and funds `vaultToAta`.", async () => {
      const tx = await program.methods.initialize(
        mintFrom,
        mintTo,
        { fixed: { 0: 0 } }
      )
        .accountsStrict({
          ...accounts
        })
        .preInstructions([
          createAssociatedTokenAccountIdempotentInstruction(admin, vaultFromAta, vault, mintFrom),
          createAssociatedTokenAccountIdempotentInstruction(admin, vaultToAta, vault, mintTo),
          createMintToInstruction(mintTo, vaultToAta, provider.publicKey!, 1e9),
        ])
        .signers([adminKeypair])
        .rpc()
        .then(confirm)
        .then(log);
    });
  })

  describe('Migrate', async () => {
    it("Migrates a user's tokens from `mintFrom` to `mintTo` with the strategy created in the `Initialize` test. Ensures that `userToTa` is initialized.", async () => {
      const tx = await program.methods.migrate(
        new BN(100_000_000)
      )
        .preInstructions([
          createAssociatedTokenAccountIdempotentInstruction(user, userToTa, user, mintTo)
        ])
        .accountsStrict({
          ...accounts,
        })
        .signers([userKeypair])
        .rpc()
        .then(confirm)
        .then(log);
    });
  })
});
