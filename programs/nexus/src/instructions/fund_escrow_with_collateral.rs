use crate::{
    errors::NexusError,
    events::CollateralDeposited,
    state::escrow::{CollateralConfig, CollateralType, EscrowAccount, EscrowStatus},
};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

const PRICE_STALE_SECONDS: i64 = 300; // 5-minute price staleness limit

#[derive(Accounts)]
#[instruction(escrow_id: String)]
pub struct FundEscrowWithCollateral<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow_id.as_bytes()],
        bump = escrow.bump,
        constraint = escrow.importer == importer.key() @ NexusError::Unauthorized,
    )]
    pub escrow: Account<'info, EscrowAccount>,

    /// Collateral token account owned by the importer
    #[account(
        mut,
        constraint = importer_collateral_account.owner == importer.key() @ NexusError::Unauthorized,
        constraint = importer_collateral_account.mint == collateral_mint.key() @ NexusError::InvalidCollateralMint,
    )]
    pub importer_collateral_account: InterfaceAccount<'info, TokenAccount>,

    /// PDA vault that holds the collateral tokens
    #[account(
        init_if_needed,
        payer = importer,
        token::mint = collateral_mint,
        token::authority = escrow,
        seeds = [b"collateral-vault", escrow_id.as_bytes()],
        bump
    )]
    pub collateral_vault: InterfaceAccount<'info, TokenAccount>,

    pub collateral_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub importer: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

/// Fund an escrow using tokenized commodity collateral instead of stablecoin.
///
/// Parameters:
/// - `collateral_amount`: number of collateral tokens to lock (raw units)
/// - `six_bfi_price`: USD price of 1 collateral token, scaled by 1e8
/// - `price_timestamp`: unix timestamp when the price was fetched (must be recent)
/// - `collateral_type`: 1=Gold, 2=Silver, 3=Platinum, 4=CommodityRwa
/// - `six_bfi_valor_bc`: VALOR_BC identifier for this collateral on SIX BFI
/// - `ltv_bps`: desired loan-to-value ratio in basis points (e.g. 8000 = 80%)
/// - `liquidation_threshold_bps`: LTV at which liquidation is triggered (e.g. 8500)
pub fn handler(
    ctx: Context<FundEscrowWithCollateral>,
    escrow_id: String,
    collateral_amount: u64,
    six_bfi_price: i64,
    price_timestamp: i64,
    collateral_type: u8,
    six_bfi_valor_bc: String,
    ltv_bps: u16,
    liquidation_threshold_bps: u16,
) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;

    require!(
        escrow.status == EscrowStatus::Created,
        NexusError::EscrowAlreadyFunded
    );

    let now = Clock::get()?.unix_timestamp;
    require!(!escrow.is_expired(now), NexusError::EscrowExpired);
    require!(collateral_amount > 0, NexusError::InvalidAmount);
    require!(six_bfi_price > 0, NexusError::InvalidAmount);
    require!(ltv_bps > 0 && ltv_bps <= 10_000, NexusError::InvalidAmount);
    require!(
        liquidation_threshold_bps >= ltv_bps && liquidation_threshold_bps <= 10_000,
        NexusError::InvalidAmount
    );
    require!(
        six_bfi_valor_bc.len() <= EscrowAccount::MAX_SIX_BFI_VALOR_BC_LEN,
        NexusError::InvalidAmount
    );

    // Verify price is not stale
    require!(
        now - price_timestamp <= PRICE_STALE_SECONDS,
        NexusError::CollateralPriceStale
    );

    // Calculate USD value: collateral_amount * six_bfi_price / 1e8
    let usd_value = (collateral_amount as i64)
        .checked_mul(six_bfi_price)
        .ok_or(NexusError::ArithmeticOverflow)?
        .checked_div(100_000_000)
        .ok_or(NexusError::ArithmeticOverflow)?;

    // Check LTV: usd_value * ltv_bps / 10000 >= deposit_amount
    let available_credit = (usd_value as u64)
        .checked_mul(ltv_bps as u64)
        .ok_or(NexusError::ArithmeticOverflow)?
        .checked_div(10_000)
        .ok_or(NexusError::ArithmeticOverflow)?;

    require!(
        available_credit >= escrow.deposit_amount,
        NexusError::CollateralValueInsufficient
    );

    let collateral_enum = match collateral_type {
        0 => CollateralType::Stablecoin,
        1 => CollateralType::TokenizedGold,
        2 => CollateralType::TokenizedSilver,
        3 => CollateralType::TokenizedPlatinum,
        _ => CollateralType::CommodityRwa,
    };

    let mint_decimals = ctx.accounts.collateral_mint.decimals;

    // Transfer collateral tokens to PDA vault
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.importer_collateral_account.to_account_info(),
                mint: ctx.accounts.collateral_mint.to_account_info(),
                to: ctx.accounts.collateral_vault.to_account_info(),
                authority: ctx.accounts.importer.to_account_info(),
            },
        ),
        collateral_amount,
        mint_decimals,
    )?;

    // Store collateral config on the escrow
    escrow.collateral = Some(CollateralConfig {
        collateral_type: collateral_enum,
        collateral_mint: ctx.accounts.collateral_mint.key(),
        collateral_amount,
        six_bfi_valor_bc,
        collateral_price_usd: six_bfi_price,
        collateral_price_updated: price_timestamp,
        ltv_bps,
        liquidation_threshold_bps,
        is_liquidated: false,
    });

    escrow.status = EscrowStatus::Funded;
    escrow.funded_at = Some(now);

    emit!(CollateralDeposited {
        escrow_id,
        collateral_type,
        collateral_amount,
        usd_value,
        ltv_bps,
        timestamp: now,
    });

    Ok(())
}
