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

const DEFAULT_PUBKEY = new PublicKey(
  "E2UxCwxi5CqbUtaibCioT8g4EpCRpX8r8M2bXAjG8jNE",
);

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
   * Initialize a new token migration vault. Permissionless: anyone can create a
   * vault and becomes its `admin`. The vault PDA is seeded by `admin`, so the
   * same `(mintFrom, mintTo)` pair can have one vault per admin.
   *
   * The program sets `payer = admin` for the vault account, so `admin` signs the
   * transaction and pays its rent; the separate `payer` only funds the
   * pre-instruction ATAs.
   *
   * NOTE: `initialize` also requires `vaultToAta` to be funded (amount > 0)
   * before it succeeds — fund it separately after the ATAs are created.
   *
   * @param mintFrom - Source mint
   * @param mintTo - Destination mint
   * @param strategy - { proRata: {} } or { fixed: { e } }
   * @param admin - Vault admin/signer; defaults to this.wallet.publicKey
   * @param payer - Funds the vault ATA accounts creation; defaults to `admin`
   */
  initializeIx(
    mintFrom: PublicKey,
    mintTo: PublicKey,
    strategy: Strategy,
    admin: PublicKey = this.wallet.publicKey,
    payer: PublicKey = admin,
  ) {
    const [vault] = getVaultAddr(
      this.tokenMigrator.programId,
      admin,
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
        admin,
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
   * Build migrate instruction(s).
   *
   * The vault must be passed explicitly: on-chain its PDA is seeded by its own
   * stored `admin` (`vault.admin`), which Anchor cannot auto-resolve. A UI
   * usually already has the vault (e.g. from `getAllVaults`); if you only have
   * the admin, derive it first with
   * `getVaultAddr(programId, admin, mintFrom, mintTo)`.
   *
   * @param mintFrom - Source mint
   * @param mintTo - Destination mint
   * @param amount - Amount to migrate
   * @param vault - The vault to migrate into
   * @param user - Defaults to this.wallet.publicKey
   * @param payer - Funds the user's destination ATA account creation; defaults to `user`
   */
  migrateIx(
    mintFrom: PublicKey,
    mintTo: PublicKey,
    amount: BN,
    vault: PublicKey,
    user: PublicKey = this.wallet.publicKey,
    payer: PublicKey = user,
  ) {
    const [vaultFromAta] = getVaultFromAtaAddr(
      vault,
      mintFrom,
      TOKEN_PROGRAM_ID,
    );
    const [vaultToAta] = getVaultToAtaAddr(vault, mintTo, TOKEN_PROGRAM_ID);
    const userFromTa = getAssociatedTokenAddressSync(mintFrom, user, true);
    const userToTa = getAssociatedTokenAddressSync(mintTo, user, true);

    return (
      this.tokenMigrator.methods
        .migrate(amount)
        // accountsPartial (not accounts): we pass the PDA accounts explicitly
        // because `vault`'s seeds reference its own `vault.admin`, which Anchor
        // cannot auto-resolve. The remaining accounts (eventAuthority,
        // tokenProgram) still resolve automatically.
        .accountsPartial({
          user,
          mintFrom,
          mintTo,
          userFromTa,
          userToTa,
          vault,
          vaultFromAta,
          vaultToAta,
          program: this.tokenMigrator.programId,
        })
        .preInstructions([
          createAssociatedTokenAccountIdempotentInstruction(
            payer,
            userToTa,
            user,
            mintTo,
          ),
        ])
    );
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

  /**
   * Fetch all vaults. Pass `admin` to return only that admin's vaults; omit it
   * to enumerate every vault (the program is permissionless, so vaults exist
   * across many admins).
   */
  async getAllVaults(
    admin?: PublicKey,
  ): Promise<Array<{ publicKey: PublicKey; account: Vault }>> {
    // `admin` is the first field after the 1-byte account discriminator
    // (`#[account(discriminator = [1])]`), so it lives at offset 1.
    return await this.tokenMigrator.account.vault.all(
      admin ? [{ memcmp: { offset: 1, bytes: admin.toBase58() } }] : [],
    );
  }

  async vaultExists(
    mintFrom: PublicKey,
    mintTo: PublicKey,
    admin: PublicKey = this.wallet.publicKey,
  ): Promise<boolean> {
    const [vault] = getVaultAddr(
      this.tokenMigrator.programId,
      admin,
      mintFrom,
      mintTo,
    );
    const v = await this.fetchVault(vault);
    return v !== null;
  }
}
