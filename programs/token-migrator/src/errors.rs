use anchor_lang::prelude::*;

#[error_code]
pub enum MigratorError {
    #[msg("Fixed strategy exponent out of range (|e| must be <= 19)")]
    ExponentOutOfRange,
    #[msg("Ratio numerator and denominator must both be non-zero")]
    InvalidRatio,
}
