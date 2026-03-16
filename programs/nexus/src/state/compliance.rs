use anchor_lang::prelude::*;

// ─────────────────────────────────────
// Fund Lineage — Source-of-Funds Chain
// ─────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum LineageEventType {
    InitialDeposit,    // First deposit into NEXUS ecosystem
    EscrowFunding,     // Locked into escrow
    EscrowSettlement,  // Released via settlement
    EscrowRefund,      // Returned to depositor
    YieldAccrual,      // Yield credited (if applicable)
    CollateralDeposit, // Commodity collateral locked
    CollateralReturn,  // Collateral returned
}

#[account]
pub struct FundLineageRecord {
    pub record_id: String,              // UUID, max 36
    pub institution_id: String,         // max 32
    pub wallet: Pubkey,
    pub escrow: Option<Pubkey>,
    pub event_type: LineageEventType,
    pub amount: u64,
    pub token_mint: Pubkey,
    pub source_hash: [u8; 32],          // SHA-256 of source-of-funds declaration
    pub previous_record: Option<Pubkey>, // Linked list — prev lineage record
    pub transaction_signature: String,  // max 88 (base58 tx sig)
    pub block_time: i64,
    pub attestation: [u8; 64],          // Ed25519 signature by protocol admin
    pub bump: u8,
}

impl FundLineageRecord {
    pub const MAX_RECORD_ID_LEN: usize = 36;
    pub const MAX_INSTITUTION_ID_LEN: usize = 32;
    pub const MAX_TX_SIG_LEN: usize = 88;

    pub const SPACE: usize = 8
        + 4 + Self::MAX_RECORD_ID_LEN       // record_id
        + 4 + Self::MAX_INSTITUTION_ID_LEN  // institution_id
        + 32                                // wallet
        + 1 + 32                            // escrow: Option<Pubkey>
        + 1                                 // event_type (enum tag)
        + 8                                 // amount
        + 32                                // token_mint
        + 32                                // source_hash
        + 1 + 32                            // previous_record: Option<Pubkey>
        + 4 + Self::MAX_TX_SIG_LEN          // transaction_signature
        + 8                                 // block_time
        + 64                                // attestation
        + 1;                                // bump
}

// ─────────────────────────────────────

#[account]
pub struct KycRegistry {
    pub registry_id: String,                  // max 32
    pub admin: Pubkey,
    pub total_institutions: u32,
    pub bump: u8,
}

impl KycRegistry {
    pub const MAX_REGISTRY_ID_LEN: usize = 32;
    pub const SPACE: usize = 8
        + 4 + Self::MAX_REGISTRY_ID_LEN
        + 32  // admin
        + 4   // total_institutions
        + 1;  // bump
}

#[account]
pub struct KycRecord {
    pub institution_id: String,               // max 32
    pub wallet: Pubkey,
    pub kyc_tier: u8,                         // 1=Basic 2=Enhanced 3=Institutional
    pub jurisdiction: String,                 // max 16
    pub verified_at: i64,
    pub expires_at: i64,
    pub is_active: bool,
    pub aml_risk_score: u8,
    pub last_aml_check: i64,
    pub travel_rule_vasp_id: String,          // max 64
    pub bump: u8,
}

impl KycRecord {
    pub const MAX_INSTITUTION_ID_LEN: usize = 32;
    pub const MAX_JURISDICTION_LEN: usize = 16;
    pub const MAX_VASP_ID_LEN: usize = 64;

    pub const SPACE: usize = 8
        + 4 + Self::MAX_INSTITUTION_ID_LEN        // institution_id
        + 32                                      // wallet
        + 1                                       // kyc_tier
        + 4 + Self::MAX_JURISDICTION_LEN          // jurisdiction
        + 8                                       // verified_at
        + 8                                       // expires_at
        + 1                                       // is_active
        + 1                                       // aml_risk_score
        + 8                                       // last_aml_check
        + 4 + Self::MAX_VASP_ID_LEN               // travel_rule_vasp_id
        + 1;                                      // bump

    pub fn is_valid(&self, now: i64) -> bool {
        self.is_active && now < self.expires_at
    }

    pub fn meets_tier(&self, required_tier: u8) -> bool {
        self.kyc_tier >= required_tier
    }
}

#[account]
pub struct TravelRuleLog {
    pub log_id: String,                       // max 32
    pub escrow: Pubkey,
    pub originator_institution_id: String,    // max 32
    pub originator_wallet: Pubkey,
    pub originator_name: String,              // max 64
    pub originator_account: String,           // max 64
    pub beneficiary_institution_id: String,   // max 32
    pub beneficiary_wallet: Pubkey,
    pub beneficiary_name: String,             // max 64
    pub beneficiary_account: String,          // max 64
    pub transfer_amount: u64,
    pub token_mint: Pubkey,
    pub transaction_reference: String,        // max 64
    pub created_at: i64,
    pub bump: u8,
}

impl TravelRuleLog {
    pub const MAX_LOG_ID_LEN: usize = 32;
    pub const MAX_INSTITUTION_ID_LEN: usize = 32;
    pub const MAX_NAME_LEN: usize = 64;
    pub const MAX_ACCOUNT_LEN: usize = 64;
    pub const MAX_TX_REF_LEN: usize = 64;

    pub const SPACE: usize = 8
        + 4 + Self::MAX_LOG_ID_LEN                // log_id
        + 32                                      // escrow
        + 4 + Self::MAX_INSTITUTION_ID_LEN        // originator_institution_id
        + 32                                      // originator_wallet
        + 4 + Self::MAX_NAME_LEN                  // originator_name
        + 4 + Self::MAX_ACCOUNT_LEN               // originator_account
        + 4 + Self::MAX_INSTITUTION_ID_LEN        // beneficiary_institution_id
        + 32                                      // beneficiary_wallet
        + 4 + Self::MAX_NAME_LEN                  // beneficiary_name
        + 4 + Self::MAX_ACCOUNT_LEN               // beneficiary_account
        + 8                                       // transfer_amount
        + 32                                      // token_mint
        + 4 + Self::MAX_TX_REF_LEN                // transaction_reference
        + 8                                       // created_at
        + 1;                                      // bump
}
