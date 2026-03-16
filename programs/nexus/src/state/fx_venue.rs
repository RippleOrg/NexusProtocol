use anchor_lang::prelude::*;

#[account]
pub struct FxVenue {
    pub venue_id: String,                     // max 32
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub total_base_liquidity: u64,
    pub total_quote_liquidity: u64,
    pub fee_bps: u16,
    pub active_quotes: Vec<Pubkey>,           // max 50
    pub six_bfi_rate: i64,                    // scaled 1e8
    pub six_bfi_updated_at: i64,
    pub max_rate_deviation_bps: u16,
    pub is_active: bool,
    pub total_lp_shares: u64,
    pub bump: u8,
}

impl FxVenue {
    pub const MAX_VENUE_ID_LEN: usize = 32;
    pub const MAX_ACTIVE_QUOTES: usize = 50;

    pub const SPACE: usize = 8
        + 4 + Self::MAX_VENUE_ID_LEN             // venue_id
        + 32                                      // base_mint
        + 32                                      // quote_mint
        + 8                                       // total_base_liquidity
        + 8                                       // total_quote_liquidity
        + 2                                       // fee_bps
        + 4 + Self::MAX_ACTIVE_QUOTES * 32        // active_quotes vec
        + 8                                       // six_bfi_rate
        + 8                                       // six_bfi_updated_at
        + 2                                       // max_rate_deviation_bps
        + 1                                       // is_active
        + 8                                       // total_lp_shares
        + 1;                                      // bump

    pub fn rate_deviation_bps(&self, offered_rate: i64) -> u64 {
        if self.six_bfi_rate == 0 {
            return 0;
        }
        let diff = (offered_rate - self.six_bfi_rate).unsigned_abs();
        // deviation = diff / six_bfi_rate * 10000
        (diff as u128)
            .saturating_mul(10_000)
            .checked_div(self.six_bfi_rate.unsigned_abs() as u128)
            .unwrap_or(u64::MAX) as u64
    }
}

#[account]
pub struct RfqQuote {
    pub quote_id: String,                     // max 32
    pub market_maker: Pubkey,
    pub market_maker_institution_id: String,  // max 32
    pub venue: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub base_amount: u64,
    pub rate: i64,                            // scaled 1e8
    pub side: QuoteSide,
    pub valid_until: i64,
    pub min_fill_amount: u64,
    pub is_filled: bool,
    pub filled_at: Option<i64>,
    pub filled_by: Option<Pubkey>,
    pub bump: u8,
}

impl RfqQuote {
    pub const MAX_QUOTE_ID_LEN: usize = 32;
    pub const MAX_INSTITUTION_ID_LEN: usize = 32;

    pub const SPACE: usize = 8
        + 4 + Self::MAX_QUOTE_ID_LEN             // quote_id
        + 32                                      // market_maker
        + 4 + Self::MAX_INSTITUTION_ID_LEN        // market_maker_institution_id
        + 32                                      // venue
        + 32                                      // base_mint
        + 32                                      // quote_mint
        + 8                                       // base_amount
        + 8                                       // rate
        + 1                                       // side
        + 8                                       // valid_until
        + 8                                       // min_fill_amount
        + 1                                       // is_filled
        + 1 + 8                                   // filled_at Option<i64>
        + 1 + 32                                  // filled_by Option<Pubkey>
        + 1;                                      // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum QuoteSide {
    Bid,
    Ask,
}

#[account]
pub struct LiquidityPosition {
    pub provider: Pubkey,
    pub venue: Pubkey,
    pub lp_shares: u64,
    pub base_deposited: u64,
    pub quote_deposited: u64,
    pub created_at: i64,
    pub bump: u8,
}

impl LiquidityPosition {
    pub const SPACE: usize = 8
        + 32  // provider
        + 32  // venue
        + 8   // lp_shares
        + 8   // base_deposited
        + 8   // quote_deposited
        + 8   // created_at
        + 1;  // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct QuoteParams {
    pub quote_id: String,
    pub venue: Pubkey,
    pub base_amount: u64,
    pub rate: i64,
    pub side: QuoteSide,
    pub valid_until: i64,
    pub min_fill_amount: u64,
}
