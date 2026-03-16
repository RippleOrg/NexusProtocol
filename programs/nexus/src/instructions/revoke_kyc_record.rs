use crate::{
    errors::NexusError,
    events::KycRevoked,
    state::{compliance::KycRecord, config::ProtocolConfig},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(institution_id: String)]
pub struct RevokeKycRecord<'info> {
    #[account(
        seeds = [b"protocol-config"],
        bump = config.bump,
        constraint = config.admin == admin.key() @ NexusError::Unauthorized,
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"kyc-record", institution_id.as_bytes()],
        bump = kyc_record.bump,
    )]
    pub kyc_record: Account<'info, KycRecord>,

    #[account(mut)]
    pub admin: Signer<'info>,
}

pub fn handler(
    ctx: Context<RevokeKycRecord>,
    institution_id: String,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let record = &mut ctx.accounts.kyc_record;
    require!(record.is_active, NexusError::KycRevoked);

    record.is_active = false;

    emit!(KycRevoked {
        institution_id,
        revoked_by: ctx.accounts.admin.key(),
        timestamp: now,
    });

    Ok(())
}
