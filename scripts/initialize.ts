import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenMigrator } from "../target/types/token_migrator";
import { PublicKey, Keypair } from "@solana/web3.js";
import { 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount
} from "@solana/spl-token";
import fs from 'fs';

const ADMIN_KEYPAIR = Keypair.fromSecretKey(
  Buffer.from(JSON.parse(fs.readFileSync('/Users/jeremy/.config/solana/id.json', 'utf-8')))
);

const MINT_FROM = new PublicKey("METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr"); 
const MINT_TO = new PublicKey("HdABxaTrV276SM8F9tud1fnEmyigeHHkttwbKHekMYNx");

async function main() {
  const connection = new anchor.web3.Connection(
    process.env.NEXT_PUBLIC_DEVNET_RPC_URL || "https://api.devnet.solana.com"
  );
  
  const wallet = new anchor.Wallet(ADMIN_KEYPAIR);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed"
  });
  
  anchor.setProvider(provider);
  const program = anchor.workspace.TokenMigrator as Program<TokenMigrator>;
  
  // Derive vault PDA
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault"),
      ADMIN_KEYPAIR.publicKey.toBuffer(),
      MINT_FROM.toBuffer(),
      MINT_TO.toBuffer()
    ],
    program.programId
  );
  
  // Get vault ATAs
  const vaultFromAta = await getAssociatedTokenAddress(
    MINT_FROM,
    vaultPda,
    true
  );
  
  const vaultToAta = await getAssociatedTokenAddress(
    MINT_TO,
    vaultPda,
    true
  );
  
  // Create ATAs if they don't exist
  const instructions = [];
  
  try {
    await getAccount(connection, vaultFromAta);
  } catch {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        ADMIN_KEYPAIR.publicKey,
        vaultFromAta,
        vaultPda,
        MINT_FROM
      )
    );
  }
  
  try {
    await getAccount(connection, vaultToAta);
  } catch {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        ADMIN_KEYPAIR.publicKey,
        vaultToAta,
        vaultPda,
        MINT_TO
      )
    );
  }
  
  if (instructions.length > 0) {
    const tx = new anchor.web3.Transaction().add(...instructions);
    await provider.sendAndConfirm(tx);
    console.log("Created ATAs");
  }
  
  // Check if vault_to_ata has funds
  const vaultToAccount = await getAccount(connection, vaultToAta);
  if (vaultToAccount.amount === BigInt(0)) {
    console.log("\n❌ ERROR: The 'to' vault needs to be funded before initialization!");
    console.log(`Send ${MINT_TO.toString()} tokens to:`);
    console.log(vaultToAccount.owner.toString());
    console.log("\nThis ensures users can receive tokens when they migrate.");
    return;
  }
  
  console.log("\n✅ Vault ATAs ready:");
  console.log(`To vault (sends tokens to users): ${vaultToAccount.owner.toString()}`);
  
  const tx = await program.methods
    .initialize(
      MINT_FROM,
      MINT_TO,
      { fixed: { e: 0 } }
    )
    .rpc();
    
  console.log("Initialized:", tx);
}

main().catch(console.error);