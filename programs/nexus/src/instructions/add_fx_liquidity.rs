use crate::{
    errors::NexusError,
    state::{
        compliance::KycRecord,
        fx_venue::{FxVenue, LiquidityPosition},
    },
    utils::math::compute_lp_shares,
};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

#[derive(Accounts)]
#[instruction(amount_a: u64, amount_b: u64, provider_institution_id: String)]
pub struct AddFxLiquidity<'info> {
    #[account(
        mut,
        seeds = [b"fx-venue", base_mint.key().as_ref(), quote_mint.key().as_ref()],
        bump = fx_venue.bump,
    )]
    pub fx_venue: Box<Account<'info, FxVenue>>,

    #[account(
        init_if_needed,
        payer = provider,
        space = LiquidityPosition::SPACE,
        seeds = [b"lp-position", fx_venue.key().as_ref(), provider.key().as_ref()],
        bump
    )]
    pub lp_position: Box<Account<'info, LiquidityPosition>>,

    #[account(
        mut,
        seeds = [b"fx-vault-base", fx_venue.key().as_ref()],
        bump,
    )]
    pub fx_vault_base: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"fx-vault-quote", fx_venue.key().as_ref()],
        bump,
    )]
    pub fx_vault_quote: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = provider_base_account.owner == provider.key() @ NexusError::Unauthorized,
        constraint = provider_base_account.mint == fx_venue.base_mint @ NexusError::InvalidFxPair,
    )]
    pub provider_base_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = provider_quote_account.owner == provider.key() @ NexusError::Unauthorized,
        constraint = provider_quote_account.mint == fx_venue.quote_mint @ NexusError::InvalidFxPair,
    )]
    pub provider_quote_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub base_mint: Box<InterfaceAccount<'info, Mint>>,
    pub quote_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        seeds = [b"kyc-record", provider_institution_id.as_bytes()],
        bump = provider_kyc.bump,
    )]
    pub provider_kyc: Box<Account<'info, KycRecord>>,

    #[account(mut)]
    pub provider: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<AddFxLiquidity>,
    amount_a: u64,
    amount_b: u64,
    _provider_institution_id: String,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let kyc = &ctx.accounts.provider_kyc;
    require!(kyc.is_active, NexusError::KycRevoked);
    require!(kyc.expires_at > now, NexusError::KycExpired);
    require!(kyc.kyc_tier >= 1, NexusError::KycTierInsufficient);
    require!(kyc.wallet == ctx.accounts.provider.key(), NexusError::Unauthorized);

    require!(amount_a > 0 && amount_b > 0, NexusError::InvalidAmount);
    let venue = &ctx.accounts.fx_venue;
    require!(venue.is_active, NexusError::VenueNotActive);

    let lp_shares = compute_lp_shares(
        amount_a,
        amount_b,
        venue.total_base_liquidity,
        venue.total_quote_liquidity,
        venue.total_lp_shares,
    )?;

    let base_decimals = ctx.accounts.base_mint.decimals;
    let quote_decimals = ctx.accounts.quote_mint.decimals;

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.provider_base_account.to_account_info(),
                mint: ctx.accounts.base_mint.to_account_info(),
                to: ctx.accounts.fx_vault_base.to_account_info(),
                authority: ctx.accounts.provider.to_account_info(),
            },
        ),
        amount_a,
        base_decimals,
    )?;

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.provider_quote_account.to_account_info(),
                mint: ctx.accounts.quote_mint.to_account_info(),
                to: ctx.accounts.fx_vault_quote.to_account_info(),
                authority: ctx.accounts.provider.to_account_info(),
            },
        ),
        amount_b,
        quote_decimals,
    )?;

    let venue_mut = &mut ctx.accounts.fx_venue;
    venue_mut.total_base_liquidity = venue_mut
        .total_base_liquidity
        .checked_add(amount_a)
        .ok_or(NexusError::ArithmeticOverflow)?;
    venue_mut.total_quote_liquidity = venue_mut
        .total_quote_liquidity
        .checked_add(amount_b)
        .ok_or(NexusError::ArithmeticOverflow)?;
    venue_mut.total_lp_shares = venue_mut
        .total_lp_shares
        .checked_add(lp_shares)
        .ok_or(NexusError::ArithmeticOverflow)?;

    let lp_pos = &mut ctx.accounts.lp_position;
    if lp_pos.lp_shares == 0 {
        lp_pos.provider = ctx.accounts.provider.key();
        lp_pos.venue = ctx.accounts.fx_venue.key();
        lp_pos.created_at = now;
        lp_pos.bump = ctx.bumps.lp_position;
    }
    lp_pos.lp_shares = lp_pos
        .lp_shares
        .checked_add(lp_shares)
        .ok_or(NexusError::ArithmeticOverflow)?;
    lp_pos.base_deposited = lp_pos
        .base_deposited
        .checked_add(amount_a)
        .ok_or(NexusError::ArithmeticOverflow)?;
    lp_pos.quote_deposited = lp_pos
        .quote_deposited
        .checked_add(amount_b)
        .ok_or(NexusError::ArithmeticOverflow)?;

    Ok(())
}
