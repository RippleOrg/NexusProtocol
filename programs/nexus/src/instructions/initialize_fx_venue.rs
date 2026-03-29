use crate::{
    errors::NexusError,
    state::{config::ProtocolConfig, fx_venue::FxVenue},
};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

#[derive(Accounts)]
#[instruction(venue_id: String)]
pub struct InitializeFxVenue<'info> {
    #[account(
        seeds = [b"protocol-config"],
        bump = config.bump,
        constraint = config.admin == admin.key() @ NexusError::Unauthorized,
    )]
    pub config: Box<Account<'info, ProtocolConfig>>,

    #[account(
        init,
        payer = admin,
        space = FxVenue::SPACE,
        seeds = [b"fx-venue", base_mint.key().as_ref(), quote_mint.key().as_ref()],
        bump
    )]
    pub fx_venue: Box<Account<'info, FxVenue>>,

    #[account(
        init,
        payer = admin,
        token::mint = base_mint,
        token::authority = fx_venue,
        seeds = [b"fx-vault-base", fx_venue.key().as_ref()],
        bump
    )]
    pub fx_vault_base: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = admin,
        token::mint = quote_mint,
        token::authority = fx_venue,
        seeds = [b"fx-vault-quote", fx_venue.key().as_ref()],
        bump
    )]
    pub fx_vault_quote: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = admin_base_account.owner == admin.key() @ NexusError::Unauthorized,
        constraint = admin_base_account.mint == base_mint.key() @ NexusError::InvalidFxPair,
    )]
    pub admin_base_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = admin_quote_account.owner == admin.key() @ NexusError::Unauthorized,
        constraint = admin_quote_account.mint == quote_mint.key() @ NexusError::InvalidFxPair,
    )]
    pub admin_quote_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub base_mint: Box<InterfaceAccount<'info, Mint>>,
    pub quote_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeFxVenue>,
    venue_id: String,
    fee_bps: u16,
    six_bfi_rate: i64,
    max_rate_deviation_bps: u16,
    initial_base_liquidity: u64,
    initial_quote_liquidity: u64,
) -> Result<()> {
    require!(!ctx.accounts.config.is_paused, NexusError::ProtocolPaused);
    require!(fee_bps <= 1_000, NexusError::InvalidAmount);
    require!(six_bfi_rate > 0, NexusError::InvalidAmount);

    let now = Clock::get()?.unix_timestamp;

    let venue = &mut ctx.accounts.fx_venue;
    venue.venue_id = venue_id;
    venue.base_mint = ctx.accounts.base_mint.key();
    venue.quote_mint = ctx.accounts.quote_mint.key();
    venue.total_base_liquidity = 0;
    venue.total_quote_liquidity = 0;
    venue.fee_bps = fee_bps;
    venue.active_quotes = Vec::new();
    venue.six_bfi_rate = six_bfi_rate;
    venue.six_bfi_updated_at = now;
    venue.max_rate_deviation_bps = max_rate_deviation_bps;
    venue.is_active = true;
    venue.total_lp_shares = initial_base_liquidity.min(initial_quote_liquidity);
    venue.bump = ctx.bumps.fx_venue;

    if initial_base_liquidity > 0 {
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.admin_base_account.to_account_info(),
                    mint: ctx.accounts.base_mint.to_account_info(),
                    to: ctx.accounts.fx_vault_base.to_account_info(),
                    authority: ctx.accounts.admin.to_account_info(),
                },
            ),
            initial_base_liquidity,
            ctx.accounts.base_mint.decimals,
        )?;

        venue.total_base_liquidity = initial_base_liquidity;
    }

    if initial_quote_liquidity > 0 {
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.admin_quote_account.to_account_info(),
                    mint: ctx.accounts.quote_mint.to_account_info(),
                    to: ctx.accounts.fx_vault_quote.to_account_info(),
                    authority: ctx.accounts.admin.to_account_info(),
                },
            ),
            initial_quote_liquidity,
            ctx.accounts.quote_mint.decimals,
        )?;

        venue.total_quote_liquidity = initial_quote_liquidity;
    }

    Ok(())
}
