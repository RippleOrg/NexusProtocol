use crate::state::{
    compliance::KycRegistry,
    config::ProtocolConfig,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(
        init,
        payer = payer,
        space = ProtocolConfig::SPACE,
        seeds = [b"protocol-config"],
        bump
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        init,
        payer = payer,
        space = KycRegistry::SPACE,
        seeds = [b"kyc-registry"],
        bump
    )]
    pub kyc_registry: Account<'info, KycRegistry>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeProtocol>,
    fee_bps: u16,
    admin: Pubkey,
    treasury: Pubkey,
) -> Result<()> {
    require!(fee_bps <= 1000, crate::errors::NexusError::InvalidAmount); // max 10%

    let config = &mut ctx.accounts.config;
    config.admin = admin;
    config.fee_bps = fee_bps;
    config.kyc_registry = ctx.accounts.kyc_registry.key();
    config.is_paused = false;
    config.treasury = treasury;
    config.bump = ctx.bumps.config;

    let registry = &mut ctx.accounts.kyc_registry;
    registry.registry_id = "NEXUS_MAIN".to_string();
    registry.admin = admin;
    registry.total_institutions = 0;
    registry.bump = ctx.bumps.kyc_registry;

    Ok(())
}
