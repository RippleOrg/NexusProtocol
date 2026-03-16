use crate::{
    errors::NexusError,
    state::fx_venue::RfqQuote,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(quote_id: String)]
pub struct CancelFxQuote<'info> {
    #[account(
        mut,
        seeds = [b"rfq-quote", quote_id.as_bytes()],
        bump = rfq_quote.bump,
        close = market_maker,
        constraint = rfq_quote.market_maker == market_maker.key() @ NexusError::Unauthorized,
        constraint = !rfq_quote.is_filled @ NexusError::QuoteAlreadyFilled,
    )]
    pub rfq_quote: Account<'info, RfqQuote>,

    #[account(mut)]
    pub market_maker: Signer<'info>,
}

pub fn handler(_ctx: Context<CancelFxQuote>, _quote_id: String) -> Result<()> {
    // Account is closed via the `close = market_maker` constraint
    // No additional logic needed
    Ok(())
}
