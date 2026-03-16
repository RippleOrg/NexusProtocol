use anchor_lang::prelude::*;

#[account]
pub struct ProtocolConfig {
    pub admin: Pubkey,
    pub fee_bps: u16,
    pub kyc_registry: Pubkey,
    pub is_paused: bool,
    pub treasury: Pubkey,
    pub bump: u8,
}

impl ProtocolConfig {
    pub const SPACE: usize = 8
        + 32  // admin
        + 2   // fee_bps
        + 32  // kyc_registry
        + 1   // is_paused
        + 32  // treasury
        + 1;  // bump
}
