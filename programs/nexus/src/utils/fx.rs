use crate::errors::NexusError;
use crate::state::fx_venue::{FxVenue, RfqQuote};
use anchor_lang::prelude::*;

/// Validate that a quote is still valid (not expired, not filled)
pub fn validate_quote(quote: &RfqQuote, now: i64) -> Result<()> {
    require!(!quote.is_filled, NexusError::QuoteAlreadyFilled);
    require!(quote.valid_until > now, NexusError::QuoteExpired);
    Ok(())
}

/// Compute the output amount for an AMM swap using constant product formula
/// x * y = k  =>  dy = y * dx / (x + dx)
pub fn compute_amm_output(
    input_amount: u64,
    input_reserve: u64,
    output_reserve: u64,
    fee_bps: u16,
) -> Result<u64> {
    require!(
        input_reserve > 0 && output_reserve > 0,
        NexusError::InsufficientLiquidity
    );
    // Apply fee: effective_input = input * (10000 - fee_bps) / 10000
    let effective_input = (input_amount as u128)
        .checked_mul((10_000 - fee_bps) as u128)
        .ok_or(NexusError::ArithmeticOverflow)?
        .checked_div(10_000)
        .ok_or(NexusError::ArithmeticOverflow)?;

    let numerator = effective_input
        .checked_mul(output_reserve as u128)
        .ok_or(NexusError::ArithmeticOverflow)?;
    let denominator = (input_reserve as u128)
        .checked_add(effective_input)
        .ok_or(NexusError::ArithmeticOverflow)?;

    let output = numerator
        .checked_div(denominator)
        .ok_or(NexusError::ArithmeticOverflow)?;

    require!(output > 0, NexusError::InsufficientLiquidity);
    require!(output <= output_reserve as u128, NexusError::InsufficientLiquidity);
    Ok(output as u64)
}

/// Compute implied rate from AMM reserves: rate = quote_reserve / base_reserve * 1e8
pub fn compute_amm_rate(base_reserve: u64, quote_reserve: u64) -> Result<i64> {
    require!(
        base_reserve > 0 && quote_reserve > 0,
        NexusError::InsufficientLiquidity
    );
    let rate = (quote_reserve as u128)
        .checked_mul(100_000_000u128)
        .ok_or(NexusError::ArithmeticOverflow)?
        .checked_div(base_reserve as u128)
        .ok_or(NexusError::ArithmeticOverflow)?;
    Ok(rate as i64)
}

/// Validate slippage: actual_rate vs expected_rate within max_slippage_bps
pub fn validate_slippage(
    actual_rate: i64,
    expected_rate: i64,
    max_slippage_bps: u16,
) -> Result<()> {
    let deviation = crate::utils::math::rate_deviation_bps(actual_rate, expected_rate)?;
    require!(
        deviation <= max_slippage_bps as u64,
        NexusError::SlippageExceeded
    );
    Ok(())
}

/// Check if venue's six_bfi_rate is stale (older than 5 minutes)
pub fn validate_rate_freshness(updated_at: i64, now: i64) -> Result<()> {
    require!(
        now - updated_at <= 300, // 5 minutes
        NexusError::RateOracleUnavailable
    );
    Ok(())
}
