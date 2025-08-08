export type { TokenMigrator } from "./token_migrator.js";

// Account types
export type Vault = {
  admin: PublicKey;
  mintFrom: PublicKey;
  mintTo: PublicKey;
  strategy: Strategy;
  bump: number[];
};

// Event types
export type MigrateEvent = {
  user: PublicKey;
  mintFrom: PublicKey;
  mintTo: PublicKey;
  depositAmount: BN;
  withdrawAmount: BN;
};

// Strategy enum type
export type Strategy = { proRata: {} } | { fixed: { e: number } };

// Re-export PublicKey and BN for convenience
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
