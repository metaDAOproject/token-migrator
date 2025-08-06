import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenMigrator } from "../target/types/token_migrator";
import { PublicKey } from "@solana/web3.js";
import { 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID 
} from "@solana/spl-token";
import BN from "bn.js";

const MINT_FROM = new PublicKey("METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr");
const MINT_TO = new PublicKey("HdABxaTrV276SM8F9tud1fnEmyigeHHkttwbKHekMYNx");
const ADMIN_PUBKEY = new PublicKey("ELT1uRmtFvYP6WSrc4mCZaW7VVbcdkcKAj39aHSVCmwH");
const AMOUNT = new BN(100_000_000); // Raw amount with decimals

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.TokenMigrator as Program<TokenMigrator>;
  const user = provider.wallet.publicKey;
  
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), ADMIN_PUBKEY.toBuffer(), MINT_FROM.toBuffer(), MINT_TO.toBuffer()],
    program.programId
  );
  
  const userFromTa = await getAssociatedTokenAddress(MINT_FROM, user);
  const userToTa = await getAssociatedTokenAddress(MINT_TO, user);
  const vaultFromAta = await getAssociatedTokenAddress(MINT_FROM, vault, true);
  const vaultToAta = await getAssociatedTokenAddress(MINT_TO, vault, true);
  
  const tx = await program.methods
    .migrate(AMOUNT)
    .preInstructions([
      createAssociatedTokenAccountIdempotentInstruction(
        user,
        userToTa,
        user,
        MINT_TO,
      ),
    ])
    .accountsStrict({
      user,
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