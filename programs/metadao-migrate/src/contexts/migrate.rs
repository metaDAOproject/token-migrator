use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};

use crate::{events::MigrateEvent, state::Vault};

#[derive(Accounts)]
pub struct Migrate<'info> {
    #[account(mut)]
    payer: Signer<'info>,
    mint_from: Box<Account<'info, Mint>>,
    mint_to: Box<Account<'info, Mint>>,
    #[account(
        mut,
        token::authority = payer,
        token::mint = mint_from
    )]
    payer_from_ta: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        token::authority = payer,
        token::mint = mint_to
    )]
    payer_to_ta: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::authority = vault,
        associated_token::mint = mint_from
    )]
    vault_from_ta: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::authority = vault,
        associated_token::mint = mint_to
    )]
    vault_to_ta: Box<Account<'info, TokenAccount>>,
    #[account(
        seeds = [b"vault", mint_from.key().as_ref(), mint_to.key().as_ref()],
        bump = vault.bump[0],
    )]
    vault: Account<'info, Vault>,
    token_program: Program<'info, Token>,
}

impl<'info> Migrate<'info> {
    pub fn migrate(&mut self, amount: u64) -> Result<()> {
        let withdraw_amount: u64 = self.vault.strategy.withdraw_amount(
            amount,
            self.mint_from
                .supply
                .saturating_sub(self.vault_from_ta.amount),
            self.vault_to_ta.amount,
        )?;

        // Deposit the `from` tokens into the vault
        let accounts = Transfer {
            from: self.payer_from_ta.to_account_info(),
            to: self.vault_from_ta.to_account_info(),
            authority: self.payer.to_account_info(),
        };

        let ctx = CpiContext::new(self.token_program.to_account_info(), accounts);

        transfer(ctx, amount)?;

        // Withdraw the `to` tokens from the vault
        let accounts = Transfer {
            from: self.vault_to_ta.to_account_info(),
            to: self.payer_to_ta.to_account_info(),
            authority: self.vault.to_account_info(),
        };

        let signer_seeds: [&[&[u8]]; 1] = [&[
            b"vault",
            self.mint_from.to_account_info().key.as_ref(),
            self.mint_to.to_account_info().key.as_ref(),
            &self.vault.bump,
        ]];

        let ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            accounts,
            &signer_seeds,
        );

        transfer(ctx, withdraw_amount)?;

        emit!(MigrateEvent {
            payer: self.payer.key(),
            mint_from: self.mint_from.key(),
            mint_to: self.mint_to.key(),
            deposit_amount: amount,
            withdraw_amount
        });

        Ok(())
    }
}
