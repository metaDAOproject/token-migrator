use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};

use crate::state::{Vault, Strategy};

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
        token::authority = vault,
        token::mint = mint_from
    )]
    vault_from_ta: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        token::authority = vault,
        token::mint = mint_to
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
        let withdraw_amount: u64 = match self.vault.strategy {
            Strategy::ProRata => {
                // How much am I depositing / How many tokens are there * what is in the vault?
                // what is in the vault *
                let circulating_supply = self
                    .mint_from
                    .supply
                    .checked_sub(self.vault_from_ta.amount)
                    .ok_or(ProgramError::ArithmeticOverflow)?;
                u128::from(self.vault_to_ta.amount)
                    .saturating_mul(amount.into())
                    .saturating_div(circulating_supply.into())
                    .try_into()
                    .map_err(|_| ProgramError::ArithmeticOverflow)?
            }
            Strategy::Fixed(e) => {
                if e == 0 {
                    amount
                } else if e < 0 {
                    let divisor = 10u64.pow(-e as u32);
                    amount
                        .checked_div(divisor)
                        .ok_or(ProgramError::ArithmeticOverflow)?
                    // divide by
                } else {
                    let multiplier = 10u64.pow(e as u32);
                    amount
                        .checked_mul(multiplier)
                        .ok_or(ProgramError::ArithmeticOverflow)?
                }
            }
        };

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

        transfer(ctx, withdraw_amount)
    }
}
