#![allow(deprecated)]
pub use anchor_lang::prelude::*;

pub mod contexts;
pub use contexts::*;

pub mod state;
pub use state::*;

pub mod events;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "token-migrator",
    project_url: "https://metadao.fi",
    contacts: "telegram:metaproph3t,telegram:kollan_house",
    source_code: "https://github.com/metaDAOproject/token-migrator",
    source_release: "v0.1.0",
    policy: "The market will decide whether we pay a bug bounty.",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("gr8tqq2ripsM6N46gLWpSDXtdrH6J9jaXoyya1ELC9t");

#[program]
pub mod token_migrator {

    use super::*;

    /// # Initialize
    /// This instruction allows the `admin` keypair defined in `constants.rs` to initialize a new token migration strategy. It takes in 3 parameters:
    ///
    /// `mint_from` - the `Mint` we are migrating from.
    /// `mint_to` - the `Mint` we are migrating to.
    /// `strategy` - the `Strategy` we are using for migration.
    ///
    /// It assumes the `vaultFromAta` and `vaultToAta` accounts for this migration are initialized and the `vaultToAta` is correctly funded ahead of time. It performs these checks in the account struct.
    #[instruction(discriminator = [1])]
    pub fn initialize(
        ctx: Context<Initialize>,
        mint_from: Pubkey,
        mint_to: Pubkey,
        strategy: Strategy,
    ) -> Result<()> {
        ctx.accounts
            .initialize(mint_from, mint_to, strategy, [ctx.bumps.vault])
    }

    /// # Migrate
    /// This instruction alows a user to migrate their token from the old token to the new one based upon a predefined token migration strategy. It assumes `userToTa` has been created ahead of time. It takes in a single parameter:
    ///
    /// `amount` - the amount of tokens the user wishes to migrate from the `mint_from` token.
    ///
    /// It also emits a `MigrationEvent` event to enable easy traceability onchain of all token migrations by users.
    #[instruction(discriminator = [0])]
    pub fn migrate(ctx: Context<Migrate>, amount: u64) -> Result<()> {
        Migrate::migrate(ctx, amount)
    }
}
