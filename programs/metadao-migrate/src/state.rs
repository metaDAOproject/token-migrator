use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Strategy {
    ProRata,
    Fixed(i8),
}

#[account(discriminator = [1])]
#[derive(InitSpace)]
pub struct Vault {
    pub mint_from: Pubkey,
    pub mint_to: Pubkey,
    pub strategy: Strategy,
    pub bump: [u8; 1],
}
