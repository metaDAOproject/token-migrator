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

const PROGRAM_ID = new PublicKey("gr8tD6dY1HrJrxzoGKUWCvATpN2qTX2E3HBcPKuGY77");
const MINT_FROM  = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
const MINT_TO    = new PublicKey("CL2woZ6wS9KwnECmUg5B5QHhLMDprMzUp19W5KDAYeQf");
const AMOUNT     = new BN(100_000_000); // raw amount

const provider = anchor.AnchorProvider.env();
const payer    = provider.wallet["payer"];

async function main() {
  const program = anchor.workspace.TokenMigrator as Program<TokenMigrator>;

  const [vault] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault"),
      payer.publicKey.toBuffer(),
      MINT_FROM.toBuffer(),
      MINT_TO.toBuffer()
    ],
    program.programId
  );

  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    program.programId
  );

  const userFromTa  = getAssociatedTokenAddressSync(MINT_FROM, payer.publicKey);
  const userToTa    = getAssociatedTokenAddressSync(MINT_TO,   payer.publicKey);
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
