use crate::{
    errors::NexusError,
    events::KycRegistered,
    state::{compliance::{KycRecord, KycRegistry}, config::ProtocolConfig},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(institution_id: String)]
pub struct RegisterInstitution<'info> {
    #[account(
        seeds = [b"protocol-config"],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"kyc-registry"],
        bump = kyc_registry.bump,
    )]
    pub kyc_registry: Account<'info, KycRegistry>,

    #[account(
        init,
        payer = admin,
        space = KycRecord::SPACE,
        seeds = [b"kyc-record", institution_id.as_bytes()],
        bump
    )]
    pub kyc_record: Account<'info, KycRecord>,

    #[account(
        mut,
        constraint = admin.key() == config.admin @ NexusError::Unauthorized
    )]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterInstitution>,
    institution_id: String,
    wallet: Pubkey,
    kyc_tier: u8,
    jurisdiction: String,
    vasp_id: String,
    expires_at: i64,
) -> Result<()> {
    require!(!ctx.accounts.config.is_paused, NexusError::ProtocolPaused);
    require!(kyc_tier >= 1 && kyc_tier <= 3, NexusError::KycTierInsufficient);

    let now = Clock::get()?.unix_timestamp;
    require!(expires_at > now, NexusError::InvalidTimestamp);
    require!(institution_id.len() <= KycRecord::MAX_INSTITUTION_ID_LEN, NexusError::InvalidAmount);
    require!(jurisdiction.len() <= KycRecord::MAX_JURISDICTION_LEN, NexusError::InvalidAmount);
    require!(vasp_id.len() <= KycRecord::MAX_VASP_ID_LEN, NexusError::InvalidAmount);

    let record = &mut ctx.accounts.kyc_record;
    record.institution_id = institution_id.clone();
    record.wallet = wallet;
    record.kyc_tier = kyc_tier;
    record.jurisdiction = jurisdiction.clone();
    record.verified_at = now;
    record.expires_at = expires_at;
    record.is_active = true;
    record.aml_risk_score = 0;
    record.last_aml_check = now;
    record.travel_rule_vasp_id = vasp_id;
    record.bump = ctx.bumps.kyc_record;

    ctx.accounts.kyc_registry.total_institutions = ctx
        .accounts
        .kyc_registry
        .total_institutions
        .checked_add(1)
        .ok_or(NexusError::ArithmeticOverflow)?;

    emit!(KycRegistered {
        institution_id,
        wallet,
        tier: kyc_tier,
        jurisdiction,
        timestamp: now,
    });

    Ok(())
}
