use anchor_lang::prelude::*;

#[event(discriminator = 0)]
pub struct MigrateEvent {
    pub payer: Pubkey,
    pub mint_from: Pubkey,
    pub mint_to: Pubkey,
    pub deposit_amount: u64,
    pub withdraw_amount: u64,
}
