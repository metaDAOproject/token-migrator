import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey, AccountInfo } from "@solana/web3.js";
// Import TypeScript types from the generated types file
import type { TokenMigrator } from "./types/token_migrator.js";
// Import the JSON IDL with the required type assertion for ESM
import TokenMigratorIDL from "./idl/token_migrator.json" with { type: "json" };
import { TOKEN_MIGRATOR_ADMIN, TOKEN_PROGRAM_ID } from "./constants.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import BN from "bn.js";
import { Vault, Strategy, MigrateEvent } from "./types/index.js";
import {
  getVaultAddr,
  getVaultFromAtaAddr,
  getVaultToAtaAddr,
  getEventAuthorityAddr,
} from "./utils/pda.js";

export type CreateTokenMigratorClientParams = {
  provider: AnchorProvider;
  tokenMigratorProgramId?: PublicKey;
};

export class TokenMigratorClient {
  public tokenMigrator: Program<TokenMigrator>;
  public provider: AnchorProvider;

  private constructor(params: CreateTokenMigratorClientParams) {
    this.provider = params.provider;
    this.tokenMigrator = new Program(TokenMigratorIDL as any, this.provider);
  }

  static createClient(
    params: CreateTokenMigratorClientParams,
  ): TokenMigratorClient {
    return new TokenMigratorClient(params);
  }

  getProgramId(): PublicKey {
    return this.tokenMigrator.programId;
  }

  async getVault(vault: PublicKey): Promise<Vault> {
    return await this.tokenMigrator.account.vault.fetch(vault);
  }

  async fetchVault(vault: PublicKey): Promise<Vault | null> {
    return await this.tokenMigrator.account.vault.fetchNullable(vault);
  }

  deserializeVault(accountInfo: AccountInfo<Buffer>): Vault {
    return this.tokenMigrator.coder.accounts.decode("vault", accountInfo.data);
  }

  deserializeMigrateEvent(data: Buffer): any {
    // Returns the raw decoded event - cast to MigrateEvent type as needed
    return this.tokenMigrator.coder.events.decode(data.toString("hex"));
  }

  /**
   * Creates a ProRata strategy object
   */
  createProRataStrategy(): Strategy {
    return { proRata: {} };
  }

  /**
   * Creates a Fixed strategy object with specified exponent
   * @param e - The exponent for 10^e scaling
   */
  createFixedStrategy(e: number): Strategy {
    return { fixed: { e } };
  }

  /**
   * Initialize a new token migration vault (admin only)
   * @param mintFrom - The mint we are migrating from
   * @param mintTo - The mint we are migrating to
   * @param strategy - The migration strategy (ProRata or Fixed)
   * @param payer - The payer for account creation (defaults to provider.publicKey)
   */
  initializeIx(
    mintFrom: PublicKey,
    mintTo: PublicKey,
    strategy: Strategy,
    payer: PublicKey = this.provider.publicKey,
  ) {
    const [vault] = getVaultAddr(
      this.tokenMigrator.programId,
      TOKEN_MIGRATOR_ADMIN,
      mintFrom,
      mintTo,
    );

    const [vaultFromAta] = getVaultFromAtaAddr(
      vault,
      mintFrom,
      TOKEN_PROGRAM_ID,
    );

    const [vaultToAta] = getVaultToAtaAddr(vault, mintTo, TOKEN_PROGRAM_ID);

    return this.tokenMigrator.methods
      .initialize(mintFrom, mintTo, strategy)
      .accounts({
        admin: TOKEN_MIGRATOR_ADMIN,
      })
      .preInstructions([
        // Create vault's token accounts if they don't exist
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          vaultFromAta,
          vault,
          mintFrom,
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          vaultToAta,
          vault,
          mintTo,
        ),
      ]);
  }

  /**
   * Migrate tokens from old mint to new mint
   * @param mintFrom - The mint we are migrating from
   * @param mintTo - The mint we are migrating to
   * @param amount - The amount of tokens to migrate
   * @param user - The user performing the migration (defaults to provider.publicKey)
   * @param payer - The payer for account creation (defaults to provider.publicKey)
   */
  migrateIx(
    mintFrom: PublicKey,
    mintTo: PublicKey,
    amount: BN,
    user: PublicKey = this.provider.publicKey,
    payer: PublicKey = this.provider.publicKey,
  ) {
    const [vault] = getVaultAddr(
      this.tokenMigrator.programId,
      TOKEN_MIGRATOR_ADMIN,
      mintFrom,
      mintTo,
    );

    const [vaultFromAta] = getVaultFromAtaAddr(
      vault,
      mintFrom,
      TOKEN_PROGRAM_ID,
    );

    const [vaultToAta] = getVaultToAtaAddr(vault, mintTo, TOKEN_PROGRAM_ID);

    const userFromTa = getAssociatedTokenAddressSync(mintFrom, user, true);

    const userToTa = getAssociatedTokenAddressSync(mintTo, user, true);

    const [eventAuthority] = getEventAuthorityAddr(
      this.tokenMigrator.programId,
    );

    return this.tokenMigrator.methods
      .migrate(amount)
      .accounts({
        user,
        mintFrom,
        mintTo,
        userFromTa,
        userToTa,
        program: this.tokenMigrator.programId,
      })
      .preInstructions([
        // Create user's destination token account if it doesn't exist
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          userToTa,
          user,
          mintTo,
        ),
      ]);
  }

  /**
   * Helper method to calculate expected output amount for a migration
   * @param vault - The vault account data
   * @param amount - The input amount
   * @param mintFromSupply - Total supply of the from mint (for ProRata)
   * @param mintToSupply - Total supply of the to mint (for ProRata)
   * @param mintFromDecimals - Decimals of the from mint (for Fixed)
   * @param mintToDecimals - Decimals of the to mint (for Fixed)
   */
  calculateMigrationAmount(
    vault: Vault,
    amount: BN,
    mintFromSupply?: BN,
    mintToSupply?: BN,
    mintFromDecimals?: number,
    mintToDecimals?: number,
  ): BN {
    if ("proRata" in vault.strategy) {
      if (!mintFromSupply || !mintToSupply) {
        throw new Error("Mint supplies required for ProRata strategy");
      }
      // ProRata: withdraw_amount = (amount * mintToSupply) / mintFromSupply
      return amount.mul(mintToSupply).div(mintFromSupply);
    } else if ("fixed" in vault.strategy) {
      const e = vault.strategy.fixed.e;
      // Fixed: withdraw_amount = amount * 10^e
      if (e >= 0) {
        return amount.mul(new BN(10).pow(new BN(e)));
      } else {
        return amount.div(new BN(10).pow(new BN(-e)));
      }
    }
    throw new Error("Unknown strategy type");
  }

  /**
   * Fetch all vaults initialized by the admin
   */
  async getAllVaults(): Promise<
    Array<{
      publicKey: PublicKey;
      account: Vault;
    }>
  > {
    const vaults = await this.tokenMigrator.account.vault.all([
      {
        memcmp: {
          offset: 8, // After discriminator
          bytes: TOKEN_MIGRATOR_ADMIN.toBase58(),
        },
      },
    ]);
    return vaults;
  }

  /**
   * Check if a vault exists for a given migration pair
   */
  async vaultExists(mintFrom: PublicKey, mintTo: PublicKey): Promise<boolean> {
    const [vault] = getVaultAddr(
      this.tokenMigrator.programId,
      TOKEN_MIGRATOR_ADMIN,
      mintFrom,
      mintTo,
    );
    const vaultAccount = await this.fetchVault(vault);
    return vaultAccount !== null;
  }
}
