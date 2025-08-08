// src/TokenMigratorClient.ts
import {
  AnchorProvider,
  Program,
  type Wallet as AnchorWallet,
} from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Transaction,
  type Commitment,
} from "@solana/web3.js";
import type { TokenMigrator } from "./types/token_migrator.js";
import TokenMigratorIDL from "./idl/token_migrator.json" with { type: "json" };
import { TOKEN_MIGRATOR_ADMIN } from "./constants.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";
import type { Vault, Strategy } from "./types/index.js";
import {
  getVaultAddr,
  getVaultFromAtaAddr,
  getVaultToAtaAddr,
} from "./utils/pda.js";

type WalletLike = {
  publicKey: PublicKey;
  signTransaction(tx: Transaction): Promise<Transaction>;
  signAllTransactions(txs: Transaction[]): Promise<Transaction[]>;
};

export type CreateTokenMigratorClientParams = {
  connection: Connection | string;
  wallet?: WalletLike; // optional; defaults to read-only wallet
  programId?: PublicKey; // optional; falls back to IDL.address
  commitment?: Commitment; // default "confirmed"
  readonlyPubkey?: PublicKey; // optional override for read-only wallet
};

const DEFAULT_PUBKEY = new PublicKey("111111111111111111111111aa111111");

function makeReadOnlyWallet(pubkey: PublicKey = DEFAULT_PUBKEY): WalletLike {
  return {
    publicKey: pubkey,
    async signTransaction() {
      throw new Error("Read-only wallet cannot sign transactions");
    },
    async signAllTransactions() {
      throw new Error("Read-only wallet cannot sign transactions");
    },
  };
}

export class TokenMigratorClient {
  public wallet: WalletLike;
  public connection: Connection;
  public provider: AnchorProvider;
  public tokenMigrator: Program<TokenMigrator>;

  private constructor(params: CreateTokenMigratorClientParams) {
    this.connection =
      typeof params.connection === "string"
        ? new Connection(params.connection, params.commitment ?? "confirmed")
        : params.connection;

    this.wallet = params.wallet ?? makeReadOnlyWallet(params.readonlyPubkey);

    this.provider = new AnchorProvider(
      this.connection,
      this.wallet as unknown as AnchorWallet,
      { commitment: params.commitment ?? "confirmed" },
    );

    this.tokenMigrator = new Program<TokenMigrator>(
      TokenMigratorIDL as any,
      this.provider,
    );
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

  deserializeVault(accountInfo: { data: Buffer }): Vault {
    return this.tokenMigrator.coder.accounts.decode("vault", accountInfo.data);
  }

  deserializeMigrateEvent(data: Buffer): any {
    return this.tokenMigrator.coder.events.decode(data.toString("hex"));
  }

  createProRataStrategy(): Strategy {
    return { proRata: {} };
  }

  createFixedStrategy(e: number): Strategy {
    return { fixed: { e } };
  }

  /**
   * Initialize a new token migration vault (admin only)
   * @param mintFrom - Source mint
   * @param mintTo - Destination mint
   * @param strategy - { proRata: {} } or { fixed: { e } }
   * @param payer - Defaults to this.wallet.publicKey
   */
  initializeIx(
    mintFrom: PublicKey,
    mintTo: PublicKey,
    strategy: Strategy,
    payer: PublicKey = this.wallet.publicKey,
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
   * Build migrate instruction(s)
   * @param mintFrom - Source mint
   * @param mintTo - Destination mint
   * @param amount - Amount to migrate
   * @param user - Defaults to this.wallet.publicKey
   * @param payer - Defaults to this.wallet.publicKey
   */
  migrateIx(
    mintFrom: PublicKey,
    mintTo: PublicKey,
    amount: BN,
    user: PublicKey = this.wallet.publicKey,
    payer: PublicKey = this.wallet.publicKey,
  ) {
    const userFromTa = getAssociatedTokenAddressSync(mintFrom, user, true);
    const userToTa = getAssociatedTokenAddressSync(mintTo, user, true);

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
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          userToTa,
          user,
          mintTo,
        ),
      ]);
  }

  /**
   * Calculate expected output amount
   * - ProRata: out = amount * mintToSupply / mintFromSupply
   * - Fixed:   out = amount * 10^e  (or / 10^|e| if e < 0)
   */
  calculateMigrationAmount(
    vault: Vault,
    amount: BN,
    mintFromSupply?: BN,
    mintToSupply?: BN,
  ): BN {
    if ("proRata" in vault.strategy) {
      if (!mintFromSupply || !mintToSupply) {
        throw new Error("Mint supplies required for ProRata strategy");
      }
      return amount.mul(mintToSupply).div(mintFromSupply);
    } else if ("fixed" in vault.strategy) {
      const e = vault.strategy.fixed.e;
      if (e >= 0) {
        return amount.mul(new BN(10).pow(new BN(e)));
      } else {
        return amount.div(new BN(10).pow(new BN(-e)));
      }
    }
    throw new Error("Unknown strategy type");
  }

  async getAllVaults(): Promise<
    Array<{ publicKey: PublicKey; account: Vault }>
  > {
    return await this.tokenMigrator.account.vault.all([
      {
        memcmp: {
          offset: 8, // discriminator
          bytes: TOKEN_MIGRATOR_ADMIN.toBase58(),
        },
      },
    ]);
  }

  async vaultExists(mintFrom: PublicKey, mintTo: PublicKey): Promise<boolean> {
    const [vault] = getVaultAddr(
      this.tokenMigrator.programId,
      TOKEN_MIGRATOR_ADMIN,
      mintFrom,
      mintTo,
    );
    const v = await this.fetchVault(vault);
    return v !== null;
  }
}
