#![allow(deprecated)]
use anchor_lang::prelude::*;

pub mod contexts;
pub use contexts::*;

pub mod constants;
pub mod state;
pub use state::*;

declare_id!("5biAh6pYRGu8YwrxX38L5yG7SL7uimNQERFF76FJ1oAh");

#[program]
pub mod metadao_migrate {

    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        mint_from: Pubkey,
        mint_to: Pubkey,
        strategy: Strategy,
    ) -> Result<()> {
        ctx.accounts
            .initialize(mint_from, mint_to, strategy, [ctx.bumps.vault])
    }

    pub fn migrate(ctx: Context<Migrate>, amount: u64) -> Result<()> {
        ctx.accounts.migrate(amount)
    }
}
