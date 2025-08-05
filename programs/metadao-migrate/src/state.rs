use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Strategy {
    ProRata,
    Fixed(i8),
}

impl Strategy {
    pub fn withdraw_amount(self, amount: u64, supply_from: u64, supply_to: u64) -> Result<u64> {
        Ok(match self {
            Strategy::ProRata => u128::from(supply_to)
                .saturating_mul(amount.into())
                .saturating_div(supply_from.into())
                .try_into()
                .map_err(|_| ProgramError::ArithmeticOverflow)?,
            Strategy::Fixed(e) => {
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
        })
    }
}

#[account(discriminator = [1])]
#[derive(InitSpace)]
pub struct Vault {
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
        let strategy = Strategy::Fixed(0);
        assert_eq!(strategy.withdraw_amount(10, 100, 100).unwrap(), 10);
    }

    #[test]
    fn test_fixed_mul_10() {
        let strategy = Strategy::Fixed(1);
        assert_eq!(strategy.withdraw_amount(10, 100, 1000).unwrap(), 100);
    }

    #[test]
    fn test_fixed_div_10() {
        let strategy = Strategy::Fixed(-1);
        assert_eq!(strategy.withdraw_amount(10, 100, 100).unwrap(), 1);
    }

    #[test]
    fn test_pro_rata() {
        let strategy = Strategy::ProRata;
        assert_eq!(strategy.withdraw_amount(10, 100, 100).unwrap(), 10);
    }
}
