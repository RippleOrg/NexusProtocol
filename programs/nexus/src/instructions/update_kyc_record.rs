use crate::{
    errors::NexusError,
    state::{compliance::KycRecord, config::ProtocolConfig},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(institution_id: String)]
pub struct UpdateKycRecord<'info> {
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
    ctx: Context<UpdateKycRecord>,
    _institution_id: String,
    new_tier: u8,
    new_expiry: i64,
    new_aml_risk_score: Option<u8>,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(new_tier >= 1 && new_tier <= 3, NexusError::KycTierInsufficient);
    require!(new_expiry > now, NexusError::InvalidTimestamp);

    let record = &mut ctx.accounts.kyc_record;
    record.kyc_tier = new_tier;
    record.expires_at = new_expiry;
    record.verified_at = now;

    if let Some(score) = new_aml_risk_score {
        record.aml_risk_score = score;
        record.last_aml_check = now;
    }

    Ok(())
}
