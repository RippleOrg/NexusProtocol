use crate::errors::NexusError;
use crate::state::compliance::KycRecord;
use anchor_lang::prelude::*;

/// Validate that a KYC record is active, not expired, and meets minimum tier
pub fn validate_kyc(record: &KycRecord, min_tier: u8, now: i64) -> Result<()> {
    require!(record.is_active, NexusError::KycRevoked);
    require!(record.expires_at > now, NexusError::KycExpired);
    require!(record.kyc_tier >= min_tier, NexusError::KycTierInsufficient);
    // Reject if AML risk score too high
    require!(
        record.aml_risk_score < crate::utils::math::AML_HIGH_RISK_THRESHOLD,
        NexusError::AmlRiskScoreTooHigh
    );
    Ok(())
}

/// Validate AML risk score is within acceptable range
pub fn validate_aml_risk(aml_risk_score: u8) -> Result<()> {
    require!(
        aml_risk_score < crate::utils::math::AML_HIGH_RISK_THRESHOLD,
        NexusError::AmlRiskScoreTooHigh
    );
    Ok(())
}

/// Check if travel rule is required and data is present
pub fn validate_travel_rule(
    amount: u64,
    travel_rule_attached: bool,
    data_populated: bool,
) -> Result<()> {
    if crate::utils::math::requires_travel_rule(amount) {
        require!(travel_rule_attached, NexusError::TravelRuleThresholdExceeded);
        require!(data_populated, NexusError::TravelRuleDataMissing);
    }
    Ok(())
}

/// Validate FX rate within permitted band of reference rate
pub fn validate_fx_rate(
    offered_rate: i64,
    reference_rate: i64,
    max_deviation_bps: u16,
) -> Result<()> {
    require!(reference_rate > 0, NexusError::RateOracleUnavailable);
    let deviation = crate::utils::math::rate_deviation_bps(offered_rate, reference_rate)?;
    require!(
        deviation <= max_deviation_bps as u64,
        NexusError::RateDeviationExceedsSixBfi
    );
    Ok(())
}
