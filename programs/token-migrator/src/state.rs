use anchor_lang::prelude::*;

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

impl Strategy {
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
}
