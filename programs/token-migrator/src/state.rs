use anchor_lang::prelude::*;

use crate::errors::MigratorError;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
/// # Strategy
///
/// Defines the strategy by which we perform a migration. There are two cases:
///
/// `ProRata` - Calculates a `withdraw_amount` based upon pro-rated supply of both tokens.
/// `Fixed(i8)` - Calculates `withdraw_amount` by scaling the `amount` deposited up or down by `10^e`. Useful for decimal redenomination.
pub enum Strategy {
    ProRata,
    Fixed { e: i8 },
}

/// Maximum magnitude of the `Fixed` exponent. `10^19` is the largest power of
/// ten that fits in a `u64` (`10^20` overflows), so bounding `|e| <= 19` keeps
/// the `10u64.pow(|e|)` scaling in `withdraw_amount` from overflowing and rules
/// out the `i8::MIN` negation panic.
pub const MAX_FIXED_EXPONENT: u8 = 19;

impl Strategy {
    /// # Validate
    /// Ensures the strategy parameters are within safe bounds before the vault
    /// is persisted. For `Fixed`, the exponent magnitude must be
    /// `<= MAX_FIXED_EXPONENT` so the `10u64.pow(|e|)` scaling in
    /// `withdraw_amount` cannot overflow. `ProRata` carries no parameters and is
    /// always valid.
    pub fn validate(&self) -> Result<()> {
        if let Strategy::Fixed { e } = self {
            require!(
                e.unsigned_abs() <= MAX_FIXED_EXPONENT,
                MigratorError::ExponentOutOfRange
            );
        }

        Ok(())
    }

    /// # Withdraw Amount
    /// Calculates the amount of tokens the user can withdraw based upon the `Strategy` implemented.
    #[inline(always)]
    pub fn withdraw_amount(self, amount: u64, supply_from: u64, supply_to: u64) -> Result<u64> {
        // Calculate amount out
        let amount = match self {
            Strategy::ProRata => u128::from(supply_to)
                .saturating_mul(amount.into())
                .saturating_div(supply_from.into())
                .try_into()
                .map_err(|_| ProgramError::ArithmeticOverflow)?,
            Strategy::Fixed { e} => {
                if e == 0 {
                    amount
                } else if e < 0 {
                    let divisor = 10u64.pow(-e as u32);
                    amount
                        .checked_div(divisor)
                        .ok_or(ProgramError::ArithmeticOverflow)?
                } else {
                    let multiplier = 10u64.pow(e as u32);
                    amount
                        .checked_mul(multiplier)
                        .ok_or(ProgramError::ArithmeticOverflow)?
                }
            }
        };

        // Ensure withdraw amount is not zero
        if amount < 1 {
            return Err(ProgramError::ArithmeticOverflow.into());
        }

        // Return amount
        Ok(amount)
    }
}

#[account(discriminator = [1])]
#[derive(InitSpace)]
pub struct Vault {
    pub admin: Pubkey,
    pub mint_from: Pubkey,
    pub mint_to: Pubkey,
    pub strategy: Strategy,
    pub bump: [u8; 1],
}

#[cfg(test)]
mod tests {
    use crate::Strategy;

    #[test]
    fn test_fixed_0() {
        let strategy = Strategy::Fixed { e: 0 };
        assert_eq!(strategy.withdraw_amount(10, 100, 100).unwrap(), 10);
    }

    #[test]
    fn test_fixed_mul_10() {
        let strategy = Strategy::Fixed { e: 1 };
        assert_eq!(strategy.withdraw_amount(10, 100, 1000).unwrap(), 100);
    }

    #[test]
    fn test_fixed_div_10() {
        let strategy = Strategy::Fixed { e: -1 };
        assert_eq!(strategy.withdraw_amount(10, 100, 100).unwrap(), 1);
    }

    #[test]
    fn test_fixed_div_1000() {
        let strategy = Strategy::Fixed { e: -3 };
        assert!(strategy.withdraw_amount(10, 100, 100).is_err());
    }

    #[test]
    fn test_pro_rata() {
        let strategy = Strategy::ProRata;
        assert_eq!(strategy.withdraw_amount(10, 100, 100).unwrap(), 10);
    }

    #[test]
    fn test_validate_pro_rata_ok() {
        assert!(Strategy::ProRata.validate().is_ok());
    }

    #[test]
    fn test_validate_fixed_within_bounds_ok() {
        assert!(Strategy::Fixed { e: 0 }.validate().is_ok());
        assert!(Strategy::Fixed { e: 19 }.validate().is_ok());
        assert!(Strategy::Fixed { e: -19 }.validate().is_ok());
    }

    #[test]
    fn test_validate_fixed_out_of_bounds_err() {
        assert!(Strategy::Fixed { e: 20 }.validate().is_err());
        assert!(Strategy::Fixed { e: -20 }.validate().is_err());
        assert!(Strategy::Fixed { e: i8::MAX }.validate().is_err());
        assert!(Strategy::Fixed { e: i8::MIN }.validate().is_err());
    }
}
