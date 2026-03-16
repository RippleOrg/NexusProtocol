use crate::errors::NexusError;
use anchor_lang::prelude::*;

/// USDC has 6 decimals. Travel rule threshold: 1000 USDC = 1_000_000_000 raw units
pub const TRAVEL_RULE_THRESHOLD_USDC: u64 = 1_000_000_000;

/// AML risk score threshold for automatic rejection
pub const AML_HIGH_RISK_THRESHOLD: u8 = 7;

/// Compute settlement amount given base amount and FX rate (scaled 1e8)
/// settlement_amount = base_amount * rate / 1e8
pub fn compute_settlement_amount(base_amount: u64, rate_scaled: i64) -> Result<u64> {
    require!(rate_scaled > 0, NexusError::InvalidAmount);
    let result = (base_amount as u128)
        .checked_mul(rate_scaled.unsigned_abs() as u128)
        .ok_or(NexusError::ArithmeticOverflow)?
        .checked_div(100_000_000u128)
        .ok_or(NexusError::ArithmeticOverflow)?;
    Ok(result as u64)
}

/// Compute protocol fee from an amount
pub fn compute_fee(amount: u64, fee_bps: u16) -> Result<u64> {
    let fee = (amount as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(NexusError::ArithmeticOverflow)?
        .checked_div(10_000)
        .ok_or(NexusError::ArithmeticOverflow)?;
    Ok(fee as u64)
}

/// Compute deviation in basis points between two rates
pub fn rate_deviation_bps(offered: i64, reference: i64) -> Result<u64> {
    require!(reference != 0, NexusError::InvalidAmount);
    let diff = (offered - reference).unsigned_abs();
    let deviation = (diff as u128)
        .checked_mul(10_000)
        .ok_or(NexusError::ArithmeticOverflow)?
        .checked_div(reference.unsigned_abs() as u128)
        .ok_or(NexusError::ArithmeticOverflow)?;
    Ok(deviation as u64)
}

/// Check if transfer amount requires travel rule (>= 1000 USDC equivalent)
pub fn requires_travel_rule(amount_raw: u64) -> bool {
    amount_raw >= TRAVEL_RULE_THRESHOLD_USDC
}

/// Safe addition
pub fn safe_add(a: u64, b: u64) -> Result<u64> {
    a.checked_add(b).ok_or(error!(NexusError::ArithmeticOverflow))
}

/// Safe subtraction
pub fn safe_sub(a: u64, b: u64) -> Result<u64> {
    a.checked_sub(b).ok_or(error!(NexusError::ArithmeticOverflow))
}

/// Compute LP shares for liquidity addition using constant product formula
pub fn compute_lp_shares(
    amount_a: u64,
    amount_b: u64,
    total_a: u64,
    total_b: u64,
    total_shares: u64,
) -> Result<u64> {
    if total_shares == 0 {
        // Initial liquidity: shares = sqrt(amount_a * amount_b)
        let product = (amount_a as u128)
            .checked_mul(amount_b as u128)
            .ok_or(error!(NexusError::ArithmeticOverflow))?;
        return Ok(integer_sqrt(product) as u64);
    }
    // Subsequent liquidity: min(a/total_a, b/total_b) * total_shares
    let shares_a = (amount_a as u128)
        .checked_mul(total_shares as u128)
        .ok_or(error!(NexusError::ArithmeticOverflow))?
        .checked_div(total_a as u128)
        .ok_or(error!(NexusError::ArithmeticOverflow))?;
    let shares_b = (amount_b as u128)
        .checked_mul(total_shares as u128)
        .ok_or(error!(NexusError::ArithmeticOverflow))?
        .checked_div(total_b as u128)
        .ok_or(error!(NexusError::ArithmeticOverflow))?;
    Ok(shares_a.min(shares_b) as u64)
}

/// Integer square root
fn integer_sqrt(n: u128) -> u128 {
    if n == 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}
