use anchor_lang::prelude::*;

use crate::{
    constants::ADMIN,
    state::{Config, Strategy},
};

#[derive(Accounts)]
#[instruction(mint_from: Pubkey, mint_to: Pubkey)]
pub struct Initialize<'info> {
    #[account(
        mut,
        address = ADMIN
    )]
    admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = Config::DISCRIMINATOR.len() + Config::INIT_SPACE,
        seeds = [b"migration", mint_from.as_ref(), mint_to.as_ref()],
        bump
    )]
    config: Account<'info, Config>,
    system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(
        &mut self,
        mint_from: Pubkey,
        mint_to: Pubkey,
        strategy: Strategy,
        bump: [u8; 1],
    ) -> Result<()> {
        self.config.set_inner(Config {
            mint_from,
            mint_to,
            strategy,
            bump,
        });
        Ok(())
    }
}
