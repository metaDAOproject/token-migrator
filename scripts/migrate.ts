import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenMigrator } from "../target/types/token_migrator";
import { PublicKey } from "@solana/web3.js";
import { 
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync
} from "@solana/spl-token";
import BN from "bn.js";

const MINT_FROM = new PublicKey("METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr");
const MINT_TO = new PublicKey("HdABxaTrV276SM8F9tud1fnEmyigeHHkttwbKHekMYNx");
const AMOUNT = new BN(100_000_000); // Raw amount with decimals

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

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
  
  const userFromTa = getAssociatedTokenAddressSync(MINT_FROM, payer.publicKey);
  const userToTa = getAssociatedTokenAddressSync(MINT_TO, payer.publicKey);
  const vaultFromAta = getAssociatedTokenAddressSync(MINT_FROM, vault, true);
  const vaultToAta = getAssociatedTokenAddressSync(MINT_TO, vault, true);
  
  const tx = await program.methods
    .migrate(AMOUNT)
    .preInstructions([
      createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,
        userToTa,
        payer.publicKey,
        MINT_TO,
      ),
    ])
    .accountsStrict({
      user: payer.publicKey,
      mintFrom: MINT_FROM,
      mintTo: MINT_TO,
      userFromTa,
      userToTa,
      vault,
      vaultFromAta,
      vaultToAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
    
  console.log("Migrated:", tx);
}

main().catch(console.error);