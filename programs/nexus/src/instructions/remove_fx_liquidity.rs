use crate::{
    errors::NexusError,
    state::fx_venue::{FxVenue, LiquidityPosition},
};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

#[derive(Accounts)]
pub struct RemoveFxLiquidity<'info> {
    #[account(
        mut,
        seeds = [b"fx-venue", base_mint.key().as_ref(), quote_mint.key().as_ref()],
        bump = fx_venue.bump,
    )]
    pub fx_venue: Box<Account<'info, FxVenue>>,

    #[account(
        mut,
        seeds = [b"lp-position", fx_venue.key().as_ref(), provider.key().as_ref()],
        bump = lp_position.bump,
        constraint = lp_position.provider == provider.key() @ NexusError::Unauthorized,
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
    )]
    pub provider_base_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = provider_quote_account.owner == provider.key() @ NexusError::Unauthorized,
    )]
    pub provider_quote_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub base_mint: Box<InterfaceAccount<'info, Mint>>,
    pub quote_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut)]
    pub provider: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(
    ctx: Context<RemoveFxLiquidity>,
    lp_amount: u64,
) -> Result<()> {
    let lp_pos = &ctx.accounts.lp_position;
    let venue = &ctx.accounts.fx_venue;

    require!(lp_amount > 0, NexusError::InvalidAmount);
    require!(lp_pos.lp_shares >= lp_amount, NexusError::InsufficientLiquidity);
    require!(venue.total_lp_shares > 0, NexusError::InsufficientLiquidity);

    // Compute proportional amounts to return
    let amount_a = (lp_amount as u128)
        .checked_mul(venue.total_base_liquidity as u128)
        .ok_or(NexusError::ArithmeticOverflow)?
        .checked_div(venue.total_lp_shares as u128)
        .ok_or(NexusError::ArithmeticOverflow)? as u64;

    let amount_b = (lp_amount as u128)
        .checked_mul(venue.total_quote_liquidity as u128)
        .ok_or(NexusError::ArithmeticOverflow)?
        .checked_div(venue.total_lp_shares as u128)
        .ok_or(NexusError::ArithmeticOverflow)? as u64;

    require!(amount_a > 0 && amount_b > 0, NexusError::InsufficientLiquidity);
    require!(
        venue.total_base_liquidity >= amount_a,
        NexusError::InsufficientLiquidity
    );
    require!(
        venue.total_quote_liquidity >= amount_b,
        NexusError::InsufficientLiquidity
    );

    let base_decimals = ctx.accounts.base_mint.decimals;
    let quote_decimals = ctx.accounts.quote_mint.decimals;
    let venue_bump = venue.bump;
    let base_mint_key = ctx.accounts.base_mint.key();
    let quote_mint_key = ctx.accounts.quote_mint.key();
    let venue_key = venue.key();

    let seeds = &[
        b"fx-venue".as_ref(),
        base_mint_key.as_ref(),
        quote_mint_key.as_ref(),
        &[venue_bump],
    ];
    let signer_seeds = &[seeds.as_ref()];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.fx_vault_base.to_account_info(),
                mint: ctx.accounts.base_mint.to_account_info(),
                to: ctx.accounts.provider_base_account.to_account_info(),
                authority: ctx.accounts.fx_venue.to_account_info(),
            },
            signer_seeds,
        ),
        amount_a,
        base_decimals,
    )?;

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.fx_vault_quote.to_account_info(),
                mint: ctx.accounts.quote_mint.to_account_info(),
                to: ctx.accounts.provider_quote_account.to_account_info(),
                authority: ctx.accounts.fx_venue.to_account_info(),
            },
            signer_seeds,
        ),
        amount_b,
        quote_decimals,
    )?;

    let venue_mut = &mut ctx.accounts.fx_venue;
    venue_mut.total_base_liquidity = venue_mut
        .total_base_liquidity
        .checked_sub(amount_a)
        .ok_or(NexusError::ArithmeticOverflow)?;
    venue_mut.total_quote_liquidity = venue_mut
        .total_quote_liquidity
        .checked_sub(amount_b)
        .ok_or(NexusError::ArithmeticOverflow)?;
    venue_mut.total_lp_shares = venue_mut
        .total_lp_shares
        .checked_sub(lp_amount)
        .ok_or(NexusError::ArithmeticOverflow)?;

    let lp_pos_mut = &mut ctx.accounts.lp_position;
    lp_pos_mut.lp_shares = lp_pos_mut
        .lp_shares
        .checked_sub(lp_amount)
        .ok_or(NexusError::ArithmeticOverflow)?;
    lp_pos_mut.venue = venue_key;

    Ok(())
}
