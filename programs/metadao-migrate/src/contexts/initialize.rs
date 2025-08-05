use anchor_lang::prelude::*;

use crate::{
    constants::ADMIN,
    state::{Vault, Strategy},
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
        space = Vault::DISCRIMINATOR.len() + Vault::INIT_SPACE,
        seeds = [b"vault", mint_from.as_ref(), mint_to.as_ref()],
        bump
    )]
    vault: Account<'info, Vault>,
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
        self.vault.set_inner(Vault {
            mint_from,
            mint_to,
            strategy,
            bump,
        });
        Ok(())
    }
}
