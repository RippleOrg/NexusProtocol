use anchor_lang::prelude::*;

#[account]
pub struct EscrowAccount {
    pub escrow_id: String,                    // max 32
    pub importer: Pubkey,
    pub exporter: Pubkey,
    pub importer_institution_id: String,      // max 32
    pub exporter_institution_id: String,      // max 32
    pub token_mint: Pubkey,
    pub vault_token_account: Pubkey,
    pub deposit_amount: u64,
    pub released_amount: u64,
    pub settlement_currency_mint: Pubkey,
    pub fx_rate_band_bps: u16,
    pub conditions: Vec<TradeCondition>,      // max 10
    pub conditions_satisfied: u8,             // bitmask
    pub status: EscrowStatus,
    pub dispute_window_hours: u8,
    pub dispute_raised_at: Option<i64>,
    pub created_at: i64,
    pub funded_at: Option<i64>,
    pub settled_at: Option<i64>,
    pub expires_at: i64,
    pub travel_rule_attached: bool,
    pub source_of_funds_hash: [u8; 32],
    pub collateral: Option<CollateralConfig>,
    pub bump: u8,
}

impl EscrowAccount {
    pub const MAX_ESCROW_ID_LEN: usize = 32;
    pub const MAX_INSTITUTION_ID_LEN: usize = 32;
    pub const MAX_CONDITIONS: usize = 10;
    pub const MAX_SIX_BFI_VALOR_BC_LEN: usize = 16;

    pub const SPACE: usize = 8  // discriminator
        + 4 + Self::MAX_ESCROW_ID_LEN            // escrow_id
        + 32                                      // importer
        + 32                                      // exporter
        + 4 + Self::MAX_INSTITUTION_ID_LEN        // importer_institution_id
        + 4 + Self::MAX_INSTITUTION_ID_LEN        // exporter_institution_id
        + 32                                      // token_mint
        + 32                                      // vault_token_account
        + 8                                       // deposit_amount
        + 8                                       // released_amount
        + 32                                      // settlement_currency_mint
        + 2                                       // fx_rate_band_bps
        + 4 + Self::MAX_CONDITIONS * TradeCondition::SPACE // conditions vec
        + 1                                       // conditions_satisfied
        + 1                                       // status
        + 1                                       // dispute_window_hours
        + 1 + 8                                   // dispute_raised_at Option<i64>
        + 8                                       // created_at
        + 1 + 8                                   // funded_at Option<i64>
        + 1 + 8                                   // settled_at Option<i64>
        + 8                                       // expires_at
        + 1                                       // travel_rule_attached
        + 32                                      // source_of_funds_hash
        + 1 + CollateralConfig::SPACE             // collateral Option<CollateralConfig>
        + 1;                                      // bump

    pub fn all_conditions_satisfied(&self) -> bool {
        if self.conditions.is_empty() {
            return false;
        }
        let expected_mask = (1u8 << self.conditions.len()) - 1;
        self.conditions_satisfied == expected_mask
    }

    pub fn is_expired(&self, now: i64) -> bool {
        now >= self.expires_at
    }

    pub fn dispute_window_active(&self, now: i64) -> bool {
        if let Some(settled_ts) = self.settled_at {
            let window_end = settled_ts + (self.dispute_window_hours as i64 * 3600);
            return now <= window_end;
        }
        // For ConditionsSatisfied state (not yet settled), check from when conditions were satisfied
        // We use created_at as baseline if funded_at is set
        false
    }

    pub fn conditions_satisfied_at(&self) -> Option<i64> {
        // Return the latest satisfied_at among all conditions
        self.conditions.iter()
            .filter(|c| c.is_satisfied)
            .filter_map(|c| c.satisfied_at)
            .max()
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EscrowStatus {
    Created,
    Funded,
    ConditionsPartial,
    ConditionsSatisfied,
    InDispute,
    Settled,
    Refunded,
    Expired,
}

impl EscrowStatus {
    pub fn to_u8(&self) -> u8 {
        match self {
            EscrowStatus::Created => 0,
            EscrowStatus::Funded => 1,
            EscrowStatus::ConditionsPartial => 2,
            EscrowStatus::ConditionsSatisfied => 3,
            EscrowStatus::InDispute => 4,
            EscrowStatus::Settled => 5,
            EscrowStatus::Refunded => 6,
            EscrowStatus::Expired => 7,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TradeCondition {
    pub condition_type: ConditionType,
    pub description: String,                  // max 128
    pub document_hash: Option<[u8; 32]>,
    pub oracle_feed: Option<Pubkey>,
    pub oracle_expected_value: Option<i64>,
    pub deadline: Option<i64>,
    pub is_satisfied: bool,
    pub satisfied_at: Option<i64>,
    pub satisfied_by: Option<Pubkey>,
    pub release_bps: u16,
}

impl TradeCondition {
    pub const MAX_DESCRIPTION_LEN: usize = 128;

    pub const SPACE: usize =
        1                                         // condition_type enum
        + 4 + Self::MAX_DESCRIPTION_LEN           // description
        + 1 + 32                                  // document_hash Option<[u8;32]>
        + 1 + 32                                  // oracle_feed Option<Pubkey>
        + 1 + 8                                   // oracle_expected_value Option<i64>
        + 1 + 8                                   // deadline Option<i64>
        + 1                                       // is_satisfied
        + 1 + 8                                   // satisfied_at Option<i64>
        + 1 + 32                                  // satisfied_by Option<Pubkey>
        + 2;                                      // release_bps
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ConditionType {
    DocumentHash,
    OracleConfirm,
    TimeBased,
    MultiSigApproval,
    ManualApproval,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TradeParams {
    pub exporter: Pubkey,
    pub exporter_institution_id: String,
    pub settlement_currency_mint: Pubkey,
    pub fx_rate_band_bps: u16,
    pub conditions: Vec<TradeCondition>,
    pub dispute_window_hours: u8,
    pub expires_at: i64,
    pub source_of_funds_hash: [u8; 32],
    pub travel_rule_data: TravelRuleData,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ConditionProof {
    pub condition_index: u8,
    pub document_hash: Option<[u8; 32]>,
    pub oracle_value: Option<i64>,
    pub approver_signatures: Vec<[u8; 64]>,
    pub proof_timestamp: i64,
    pub metadata_uri: String,                 // max 200
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TravelRuleData {
    pub originator_name: String,              // max 64
    pub originator_account: String,           // max 64
    pub beneficiary_name: String,             // max 64
    pub beneficiary_account: String,          // max 64
    pub transaction_reference: String,        // max 64
}

impl TravelRuleData {
    pub fn is_populated(&self) -> bool {
        !self.originator_name.is_empty()
            && !self.originator_account.is_empty()
            && !self.beneficiary_name.is_empty()
            && !self.beneficiary_account.is_empty()
            && !self.transaction_reference.is_empty()
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct FxExecutionParams {
    pub quote_id: Option<String>,
    pub max_slippage_bps: u16,
    pub execution_mode: FxExecutionMode,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum FxExecutionMode {
    RfqQuote,
    AmmPool,
    BestAvailable,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum DisputeRuling {
    ExporterWins,
    ImporterWins,
}

// ─── Precious Metals / Commodity Collateral ────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum CollateralType {
    Stablecoin,       // Standard USDC collateral (existing path)
    TokenizedGold,    // Tokenized gold (e.g. PAXG, TER)
    TokenizedSilver,
    TokenizedPlatinum,
    CommodityRwa,     // Generic RWA token
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CollateralConfig {
    pub collateral_type: CollateralType,
    pub collateral_mint: Pubkey,                         // Token mint of collateral asset
    pub collateral_amount: u64,                          // Amount locked
    pub six_bfi_valor_bc: String,                        // e.g. "274702_148" for Gold (max 16)
    pub collateral_price_usd: i64,                       // Price at deposit time (scaled 1e8)
    pub collateral_price_updated: i64,                   // Timestamp of price fetch
    pub ltv_bps: u16,                                    // Loan-to-value ratio in basis points (e.g. 8000 = 80%)
    pub liquidation_threshold_bps: u16,                  // e.g. 8500 = liquidate at 85% LTV
    pub is_liquidated: bool,
}

impl CollateralConfig {
    pub const SPACE: usize =
        1                                              // collateral_type enum
        + 32                                           // collateral_mint
        + 8                                            // collateral_amount
        + 4 + EscrowAccount::MAX_SIX_BFI_VALOR_BC_LEN // six_bfi_valor_bc
        + 8                                            // collateral_price_usd
        + 8                                            // collateral_price_updated
        + 2                                            // ltv_bps
        + 2                                            // liquidation_threshold_bps
        + 1;                                           // is_liquidated
}
