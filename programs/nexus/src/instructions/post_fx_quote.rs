use crate::{
    errors::NexusError,
    events::FxQuotePosted,
    state::{
        compliance::KycRecord,
        config::ProtocolConfig,
        fx_venue::{FxVenue, QuoteParams, RfqQuote},
    },
    utils::compliance::validate_fx_rate,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(params: QuoteParams)]
pub struct PostFxQuote<'info> {
    #[account(
        seeds = [b"protocol-config"],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"fx-venue", params.venue.as_ref()],
        bump = fx_venue.bump,
    )]
    pub fx_venue: Account<'info, FxVenue>,

    #[account(
        init,
        payer = market_maker,
        space = RfqQuote::SPACE,
        seeds = [b"rfq-quote", params.quote_id.as_bytes()],
        bump
    )]
    pub rfq_quote: Account<'info, RfqQuote>,

    #[account(
        seeds = [b"kyc-record", market_maker_institution_id.as_bytes()],
        bump = market_maker_kyc.bump,
    )]
    pub market_maker_kyc: Account<'info, KycRecord>,

    #[account(mut)]
    pub market_maker: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<PostFxQuote>,
    params: QuoteParams,
    market_maker_institution_id: String,
) -> Result<()> {
    require!(!ctx.accounts.config.is_paused, NexusError::ProtocolPaused);

    let now = Clock::get()?.unix_timestamp;

    // KYC tier 2+ required
    let kyc = &ctx.accounts.market_maker_kyc;
    require!(kyc.is_active, NexusError::KycRevoked);
    require!(kyc.expires_at > now, NexusError::KycExpired);
    require!(kyc.kyc_tier >= 2, NexusError::KycTierInsufficient);
    require!(
        kyc.wallet == ctx.accounts.market_maker.key(),
        NexusError::Unauthorized
    );

    // FX venue must be active
    let venue = &ctx.accounts.fx_venue;
    require!(venue.is_active, NexusError::VenueNotActive);
    require!(params.valid_until > now, NexusError::InvalidTimestamp);
    require!(params.base_amount > 0, NexusError::InvalidAmount);

    // Validate rate within max_rate_deviation_bps of SIX BFI rate
    validate_fx_rate(
        params.rate,
        venue.six_bfi_rate,
        venue.max_rate_deviation_bps,
    )?;

    // Validate pair matches venue
    require!(
        params.venue == ctx.accounts.fx_venue.key(),
        NexusError::InvalidFxPair
    );

    let quote = &mut ctx.accounts.rfq_quote;
    quote.quote_id = params.quote_id.clone();
    quote.market_maker = ctx.accounts.market_maker.key();
    quote.market_maker_institution_id = market_maker_institution_id;
    quote.venue = params.venue;
    quote.base_mint = venue.base_mint;
    quote.quote_mint = venue.quote_mint;
    quote.base_amount = params.base_amount;
    quote.rate = params.rate;
    quote.side = params.side;
    quote.valid_until = params.valid_until;
    quote.min_fill_amount = params.min_fill_amount;
    quote.is_filled = false;
    quote.filled_at = None;
    quote.filled_by = None;
    quote.bump = ctx.bumps.rfq_quote;

    emit!(FxQuotePosted {
        quote_id: params.quote_id,
        market_maker: ctx.accounts.market_maker.key(),
        base_mint: venue.base_mint,
        quote_mint: venue.quote_mint,
        rate: params.rate,
        amount: params.base_amount,
        valid_until: params.valid_until,
    });

    Ok(())
}
