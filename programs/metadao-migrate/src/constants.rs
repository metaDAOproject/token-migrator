use anchor_lang::{prelude::Pubkey, pubkey};

#[cfg(not(feature = "mainnet"))]
pub const ADMIN: Pubkey = pubkey!("gr8zGEubscQFgPQ5srfFJg4HRVo2zVFm8YV4CRcFYp4");

#[cfg(feature = "mainnet")]
pub const ADMIN: Pubkey = pubkey!("gr8zGEubscQFgPQ5srfFJg4HRVo2zVFm8YV4CRcFYp4");
