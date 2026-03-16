use anchor_lang::prelude::*;

#[error_code]
pub enum NexusError {
    // KYC / Compliance
    #[msg("Institution is not KYC registered")]
    InstitutionNotKyced,
    #[msg("KYC record has expired")]
    KycExpired,
    #[msg("KYC tier is insufficient for this operation")]
    KycTierInsufficient,
    #[msg("KYC record has been revoked")]
    KycRevoked,

    // AML
    #[msg("Address matches sanctions list")]
    AmlSanctionsMatch,
    #[msg("AML risk score exceeds permitted threshold")]
    AmlRiskScoreTooHigh,
    #[msg("AML check is required before proceeding")]
    AmlCheckRequired,

    // Escrow lifecycle
    #[msg("Escrow has already been funded")]
    EscrowAlreadyFunded,
    #[msg("Escrow has not been funded yet")]
    EscrowNotFunded,
    #[msg("Escrow has already been settled")]
    EscrowAlreadySettled,
    #[msg("Escrow has expired")]
    EscrowExpired,
    #[msg("Escrow is currently in dispute")]
    EscrowInDispute,
    #[msg("Escrow is not in dispute")]
    EscrowNotInDispute,

    // Conditions
    #[msg("Condition has already been satisfied")]
    ConditionAlreadySatisfied,
    #[msg("Condition index is out of bounds")]
    ConditionIndexOutOfBounds,
    #[msg("Condition proof is invalid")]
    ConditionProofInvalid,
    #[msg("Document hash does not match condition requirement")]
    DocumentHashMismatch,
    #[msg("Oracle value does not match expected condition value")]
    OracleValueMismatch,
    #[msg("Not all conditions have been satisfied")]
    NotAllConditionsSatisfied,
    #[msg("Dispute window is still active")]
    DisputeWindowActive,
    #[msg("Dispute window has expired")]
    DisputeWindowExpired,
    #[msg("Unauthorized to raise dispute")]
    UnauthorizedDispute,

    // FX / Quotes
    #[msg("Quote has expired")]
    QuoteExpired,
    #[msg("Quote has already been filled")]
    QuoteAlreadyFilled,
    #[msg("Rate is outside permitted band")]
    RateOutsideBand,
    #[msg("Rate deviation exceeds SIX BFI reference rate threshold")]
    RateDeviationExceedsSixBfi,
    #[msg("Insufficient liquidity in FX pool")]
    InsufficientLiquidity,
    #[msg("Slippage exceeds permitted maximum")]
    SlippageExceeded,
    #[msg("Invalid FX pair")]
    InvalidFxPair,
    #[msg("Rate oracle is unavailable")]
    RateOracleUnavailable,

    // Travel Rule
    #[msg("Transfer amount exceeds travel rule threshold but data is missing")]
    TravelRuleThresholdExceeded,
    #[msg("Travel rule data is missing or incomplete")]
    TravelRuleDataMissing,

    // General
    #[msg("Unauthorized operation")]
    Unauthorized,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Invalid timestamp")]
    InvalidTimestamp,
    #[msg("Protocol is currently paused")]
    ProtocolPaused,
    #[msg("Maximum number of conditions reached")]
    MaxConditionsReached,
    #[msg("FX venue is not active")]
    VenueNotActive,
    #[msg("Escrow is not in the correct status for this operation")]
    InvalidEscrowStatus,

    // Collateral
    #[msg("Collateral USD value is insufficient to cover required LTV")]
    CollateralValueInsufficient,
    #[msg("Current LTV exceeds liquidation threshold")]
    CollateralLtvExceeded,
    #[msg("Collateral price data is stale")]
    CollateralPriceStale,
    #[msg("Collateral has already been liquidated")]
    CollateralAlreadyLiquidated,
    #[msg("Invalid collateral token mint")]
    InvalidCollateralMint,
}
