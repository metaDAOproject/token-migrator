use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};

use crate::{events::MigrateEvent, state::Vault};

#[derive(Accounts)]
pub struct Migrate<'info> {
    #[account(mut)]
    user: Signer<'info>,
    mint_from: Box<Account<'info, Mint>>,
    mint_to: Box<Account<'info, Mint>>,
    #[account(
        mut,
        token::authority = user,
        token::mint = mint_from
    )]
    user_from_ta: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        token::authority = user,
        token::mint = mint_to
    )]
    user_to_ta: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::authority = vault,
        associated_token::mint = mint_from
    )]
    vault_from_ata: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::authority = vault,
        associated_token::mint = mint_to
    )]
    vault_to_ata: Box<Account<'info, TokenAccount>>,
    #[account(
        seeds = [b"vault", vault.admin.as_ref(), mint_from.key().as_ref(), mint_to.key().as_ref()],
        bump = vault.bump[0],
    )]
    vault: Account<'info, Vault>,
    token_program: Program<'info, Token>,
}

impl<'info> Migrate<'info> {
    /// # Migrate
    ///
    /// Implements the following operations in order:
    ///
    /// 1. Calculate `withdraw_amount` owed to the user.
    /// 2. Deposit the correct `amount` from `userFromTa` to `vaultFromAta`.
    /// 3. Withdraw `withdraw_amount` from `vaultToAta` to `userToTa`.
    /// 4. Emit a `MigrateEvent`.
    pub fn migrate(&mut self, amount: u64) -> Result<()> {
        let withdraw_amount = self.withdraw_amount(amount)?;
        self.deposit_tokens(amount)?;
        self.withdraw_tokens(withdraw_amount)?;
        self.emit_migrate_event(amount, withdraw_amount)
    }

    /// # Deposit Tokens
    ///
    /// Deposits the `amount` of tokens from `userFromTa` to `vaultFromAta`.
    #[inline(always)]
    fn deposit_tokens(&mut self, amount: u64) -> Result<()> {
        // Deposit the `from` tokens into the vault
        let accounts = Transfer {
            from: self.user_from_ta.to_account_info(),
            to: self.vault_from_ata.to_account_info(),
            authority: self.user.to_account_info(),
        };

        let ctx = CpiContext::new(self.token_program.to_account_info(), accounts);

        transfer(ctx, amount)
    }

    /// # Withdraw Tokens
    ///
    /// Withdraws the `withdraw_amount` of tokens from `vaultToAta` to `userToTa`.
    #[inline(always)]
    fn withdraw_tokens(&mut self, withdraw_amount: u64) -> Result<()> {
        // Withdraw the `to` tokens from the vault
        let accounts = Transfer {
            from: self.vault_to_ata.to_account_info(),
            to: self.user_to_ta.to_account_info(),
            authority: self.vault.to_account_info(),
        };

        let admin = self.vault.admin.key();

        let signer_seeds: [&[&[u8]]; 1] = [&[
            b"vault",
            admin.as_ref(),
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

    /// # Emit Migrate Event
    ///
    /// Emits a `MigrateEvent` enabling us to easily index all token migrations.
    #[inline(always)]
    fn emit_migrate_event(&mut self, amount: u64, withdraw_amount: u64) -> Result<()> {
        emit!(MigrateEvent {
            user: self.user.key(),
            mint_from: self.mint_from.key(),
            mint_to: self.mint_to.key(),
            deposit_amount: amount,
            withdraw_amount
        });

        Ok(())
    }

    /// # Supply From
    ///
    /// Calculates supply of `from` token to simulate a token burn. This is calculated by:
    /// ```
    /// let supply_from = mint_from.supply - vault_from_ata.amount
    /// ```
    #[inline(always)]
    fn supply_from(&mut self) -> u64 {
        // Safety: saturating_sub is safe as token account balance cannot exceed mint supply
        self.mint_from
            .supply
            .saturating_sub(self.vault_from_ata.amount)
    }

    /// # Supply To
    ///
    /// Returns the supply of the `to` token vault
    #[inline(always)]
    fn supply_to(&mut self) -> u64 {
        self.vault_to_ata.amount
    }

    /// # Supply To
    /// Calculates the `withdraw_amount` of the `to` token based upon `supply_from`, `supply_to`, `amount` and `strategy`
    #[inline(always)]
    fn withdraw_amount(&mut self, amount: u64) -> Result<u64> {
        self.vault
            .strategy
            .withdraw_amount(amount, self.supply_from(), self.supply_to())
    }
}
