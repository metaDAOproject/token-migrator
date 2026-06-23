import { PublicKey } from "@solana/web3.js";

export const TOKEN_MIGRATOR_PROGRAM_ID = new PublicKey(
  "gr8tqq2ripsM6N46gLWpSDXtdrH6J9jaXoyya1ELC9t",
);

/**
 * @deprecated Initialization is now permissionless — any signer can create a
 * vault and becomes its own admin, so there is no single "token migrator admin".
 * This is the key from the program's original admin-gated era, kept for
 * backwards compatibility and as a reference to those original vaults (e.g.
 * `client.getAllVaults(TOKEN_MIGRATOR_ADMIN)`). The SDK does not use it anywhere.
 */
export const TOKEN_MIGRATOR_ADMIN = new PublicKey(
  "ELT1uRmtFvYP6WSrc4mCZaW7VVbcdkcKAj39aHSVCmwH",
);
