import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenMigrator } from "../target/types/token_migrator";
import { PublicKey } from "@solana/web3.js";
import { 
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount
} from "@solana/spl-token";
import BN from "bn.js";
import { ADMIN_PUBLIC_KEY } from "./consts";

const PROGRAM_ID = new PublicKey("gr8tqq2ripsM6N46gLWpSDXtdrH6J9jaXoyya1ELC9t");
const MINT_FROM  = new PublicKey("METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr"); // This is inbound from the user
const MINT_TO    = new PublicKey("METAwkXcqyXKy1AtsSgJ8JiUHwGCafnZL38n3vYmeta"); // This is what the user expects out
const AMOUNT     = new BN(10_000_000); // raw amount

const provider = anchor.AnchorProvider.env();
const payer    = provider.wallet["payer"];

async function main() {
  const program = anchor.workspace.TokenMigrator as Program<TokenMigrator>;

  const [vault] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault"),
      ADMIN_PUBLIC_KEY.toBuffer(),
      MINT_FROM.toBuffer(),
      MINT_TO.toBuffer()
    ],
    program.programId
  );

  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    program.programId
  );

  const userFromTa  = getAssociatedTokenAddressSync(MINT_FROM, payer.publicKey, true);
  const userToTa    = getAssociatedTokenAddressSync(MINT_TO,   payer.publicKey, true);
  const vaultFromAta= getAssociatedTokenAddressSync(MINT_FROM, vault, true);
  const vaultToAta  = getAssociatedTokenAddressSync(MINT_TO,   vault, true);

  const preInstructions = [
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      userToTa,
      payer.publicKey,
      MINT_TO,
    ),
  ];

  try {
    await getAccount(provider.connection, vaultFromAta);
  } catch {
    preInstructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,
        vaultFromAta,
        vault,
        MINT_FROM,
      )
    );
  }

  try {
    await getAccount(provider.connection, vaultToAta);
  } catch {
    preInstructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,
        vaultToAta,
        vault,
        MINT_TO,
      )
    );
  }

  const tx = await program.methods
    .migrate(AMOUNT)
    .preInstructions(preInstructions)
    .accountsStrict({
      user:           payer.publicKey,
      mintFrom:       MINT_FROM,
      mintTo:         MINT_TO,
      userFromTa,
      userToTa,
      vaultFromAta,
      vaultToAta,
      vault,
      tokenProgram:   TOKEN_PROGRAM_ID,
      eventAuthority,                
      program:        PROGRAM_ID,    
    })
    .transaction();

  // send it
  try {
    const sig = await provider.sendAndConfirm(tx);
    console.log("Migration successful! Sig:", sig);
  } catch (err) {
    console.error("Error sending migration tx:", err);
  }
}

main().catch(console.error);
