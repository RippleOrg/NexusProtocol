use anchor_lang::prelude::*;

#[event]
pub struct EscrowCreated {
    pub escrow_id: String,
    pub importer: Pubkey,
    pub exporter: Pubkey,
    pub amount: u64,
    pub token_mint: Pubkey,
    pub conditions_count: u8,
    pub expires_at: i64,
    pub timestamp: i64,
}

#[event]
pub struct EscrowFunded {
    pub escrow_id: String,
    pub importer: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct ConditionSatisfied {
    pub escrow_id: String,
    pub condition_index: u8,
    pub condition_type: u8,
    pub satisfied_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct EscrowSettled {
    pub escrow_id: String,
    pub importer: Pubkey,
    pub exporter: Pubkey,
    pub base_amount: u64,
    pub fx_rate: i64,
    pub settlement_amount: u64,
    pub settlement_currency: Pubkey,
    pub settlement_ms: u64,
    pub travel_rule_log: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct DisputeRaised {
    pub escrow_id: String,
    pub importer: Pubkey,
    pub reason: String,
    pub timestamp: i64,
}

#[event]
pub struct DisputeResolved {
    pub escrow_id: String,
    pub ruling: u8,
    pub resolved_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct EscrowRefunded {
    pub escrow_id: String,
    pub importer: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct FxQuotePosted {
    pub quote_id: String,
    pub market_maker: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub rate: i64,
    pub amount: u64,
    pub valid_until: i64,
}

#[event]
pub struct FxQuoteFilled {
    pub quote_id: String,
    pub filled_by: Pubkey,
    pub fill_amount: u64,
    pub rate: i64,
    pub timestamp: i64,
}

#[event]
pub struct KycRegistered {
    pub institution_id: String,
    pub wallet: Pubkey,
    pub tier: u8,
    pub jurisdiction: String,
    pub timestamp: i64,
}

#[event]
pub struct KycRevoked {
    pub institution_id: String,
    pub revoked_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct TravelRuleEmitted {
    pub log_id: String,
    pub escrow: Pubkey,
    pub transfer_amount: u64,
    pub originator_institution_id: String,
    pub beneficiary_institution_id: String,
    pub timestamp: i64,
}

#[event]
pub struct AmlFlagRaised {
    pub wallet: Pubkey,
    pub institution_id: String,
    pub risk_score: u8,
    pub timestamp: i64,
}

#[event]
pub struct CollateralDeposited {
    pub escrow_id: String,
    pub collateral_type: u8,  // CollateralType as u8: 0=Stablecoin,1=Gold,2=Silver,3=Platinum,4=Rwa
    pub collateral_amount: u64,
    pub usd_value: i64,
    pub ltv_bps: u16,
    pub timestamp: i64,
}

#[event]
pub struct CollateralHealthUpdated {
    pub escrow_id: String,
    pub current_ltv_bps: u16,
    pub threshold_bps: u16,
    pub is_healthy: bool,
    pub timestamp: i64,
}

#[event]
pub struct CollateralLiquidated {
    pub escrow_id: String,
    pub collateral_amount: u64,
    pub usd_value_at_liquidation: i64,
    pub timestamp: i64,
}
