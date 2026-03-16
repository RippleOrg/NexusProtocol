use crate::{
    errors::NexusError,
    events::CollateralHealthUpdated,
    state::{
        compliance::KycRecord,
        config::ProtocolConfig,
        escrow::{EscrowAccount, EscrowStatus},
    },
};
use anchor_lang::prelude::*;

const PRICE_STALE_SECONDS: i64 = 300; // 5-minute price staleness limit

#[derive(Accounts)]
#[instruction(escrow_id: String)]
pub struct CheckCollateralHealth<'info> {
    #[account(
        seeds = [b"protocol-config"],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"escrow", escrow_id.as_bytes()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, EscrowAccount>,

    /// The admin or oracle submitting the updated price. Must be the protocol admin.
    #[account(
        constraint = admin_or_oracle.key() == config.admin @ NexusError::Unauthorized,
    )]
    pub admin_or_oracle: Signer<'info>,

    /// KYC record of the admin (to satisfy compliance check structure)
    #[account(
        seeds = [b"kyc-record", admin_institution_id.as_bytes()],
        bump = admin_kyc.bump,
    )]
    pub admin_kyc: Account<'info, KycRecord>,
}

/// Submit an updated collateral price and check whether the escrow is still healthy.
///
/// Parameters:
/// - `current_price`: current USD price of 1 collateral token, scaled by 1e8
/// - `price_timestamp`: unix timestamp when the price was fetched
/// - `admin_institution_id`: institution ID of the submitting admin/oracle
pub fn handler(
    ctx: Context<CheckCollateralHealth>,
    escrow_id: String,
    current_price: i64,
    price_timestamp: i64,
    _admin_institution_id: String,
) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;

    // Only meaningful for funded escrows that have not yet been settled or refunded
    require!(
        escrow.status == EscrowStatus::Funded
            || escrow.status == EscrowStatus::ConditionsPartial
            || escrow.status == EscrowStatus::ConditionsSatisfied,
        NexusError::InvalidEscrowStatus
    );

    // Extract deposit_amount before mutable borrow of collateral
    let deposit_amount = escrow.deposit_amount;

    let collateral = escrow
        .collateral
        .as_mut()
        .ok_or(NexusError::InvalidEscrowStatus)?;

    require!(!collateral.is_liquidated, NexusError::CollateralAlreadyLiquidated);

    let now = Clock::get()?.unix_timestamp;

    require!(current_price > 0, NexusError::InvalidAmount);
    require!(
        now - price_timestamp <= PRICE_STALE_SECONDS,
        NexusError::CollateralPriceStale
    );

    // Update stored price
    collateral.collateral_price_usd = current_price;
    collateral.collateral_price_updated = price_timestamp;

    // Current USD value of collateral at new price
    let current_usd_value = (collateral.collateral_amount as i64)
        .checked_mul(current_price)
        .ok_or(NexusError::ArithmeticOverflow)?
        .checked_div(100_000_000)
        .ok_or(NexusError::ArithmeticOverflow)?;

    // Current LTV = deposit_amount / current_usd_value (in bps)
    let current_ltv_bps = if current_usd_value > 0 {
        ((deposit_amount as u128)
            .checked_mul(10_000)
            .ok_or(NexusError::ArithmeticOverflow)?
            .checked_div(current_usd_value as u128)
            .ok_or(NexusError::ArithmeticOverflow)?) as u16
    } else {
        10_000 // treat as 100% LTV when value is zero
    };

    let threshold_bps = collateral.liquidation_threshold_bps;
    let is_healthy = current_ltv_bps < threshold_bps;

    // Trigger liquidation flag if threshold is breached
    if !is_healthy {
        collateral.is_liquidated = true;
    }

    emit!(CollateralHealthUpdated {
        escrow_id,
        current_ltv_bps,
        threshold_bps,
        is_healthy,
        timestamp: now,
    });

    Ok(())
}
