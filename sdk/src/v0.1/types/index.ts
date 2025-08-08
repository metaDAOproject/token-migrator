import { TokenMigrator as TokenMigratorProgram } from "./token_migrator.js";

export type { TokenMigrator } from "./token_migrator.js";

// Account types
export type Vault = {
  admin: PublicKey;
  mintFrom: PublicKey;
  mintTo: PublicKey;
  strategy: Strategy;
  bump: number[];
};

export type MigrateEvent = IdlEvents<TokenMigratorProgram>["migrateEvent"];

export type TokenMigrationEvents = MigrateEvent;

// Strategy enum type
export type Strategy = { proRata: {} } | { fixed: { e: number } };

import { IdlEvents } from "@coral-xyz/anchor";
// Re-export PublicKey and BN for convenience
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
