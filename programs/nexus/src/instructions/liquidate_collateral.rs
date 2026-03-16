use crate::{
    errors::NexusError,
    events::CollateralLiquidated,
    state::{
        config::ProtocolConfig,
        escrow::{EscrowAccount, EscrowStatus},
    },
};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

#[derive(Accounts)]
#[instruction(escrow_id: String)]
pub struct LiquidateCollateral<'info> {
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

    /// PDA vault holding the collateral tokens
    #[account(
        mut,
        seeds = [b"collateral-vault", escrow_id.as_bytes()],
        bump,
    )]
    pub collateral_vault: InterfaceAccount<'info, TokenAccount>,

    /// Protocol treasury token account to receive liquidated collateral
    #[account(
        mut,
        constraint = treasury_token_account.owner == config.treasury @ NexusError::Unauthorized,
    )]
    pub treasury_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Importer token account to receive proportional refund
    #[account(
        mut,
        constraint = importer_refund_account.owner == escrow.importer @ NexusError::Unauthorized,
    )]
    pub importer_refund_account: InterfaceAccount<'info, TokenAccount>,

    pub collateral_mint: InterfaceAccount<'info, Mint>,

    /// Admin must authorize liquidation
    #[account(
        constraint = admin.key() == config.admin @ NexusError::Unauthorized,
    )]
    pub admin: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

/// Execute liquidation of collateral that has been flagged by check_collateral_health.
///
/// Transfers collateral tokens:
///   - Proportional refund to importer (based on remaining LTV headroom)
///   - Remainder to protocol treasury
pub fn handler(ctx: Context<LiquidateCollateral>, escrow_id: String) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;

    require!(
        escrow.status == EscrowStatus::Funded
            || escrow.status == EscrowStatus::ConditionsPartial
            || escrow.status == EscrowStatus::ConditionsSatisfied,
        NexusError::InvalidEscrowStatus
    );

    let collateral = escrow
        .collateral
        .as_ref()
        .ok_or(NexusError::InvalidEscrowStatus)?;

    require!(collateral.is_liquidated, NexusError::InvalidEscrowStatus);

    let collateral_amount = collateral.collateral_amount;
    let price = collateral.collateral_price_usd;

    // Current USD value at last known price
    let usd_value = (collateral_amount as i64)
        .checked_mul(price)
        .ok_or(NexusError::ArithmeticOverflow)?
        .checked_div(100_000_000)
        .ok_or(NexusError::ArithmeticOverflow)?;

    // Proportional importer refund: max(0, usd_value - deposit_amount) / usd_value * collateral_amount
    let importer_refund_amount = if usd_value > escrow.deposit_amount as i64 {
        let excess_usd = usd_value - escrow.deposit_amount as i64;
        ((excess_usd as u128)
            .checked_mul(collateral_amount as u128)
            .ok_or(NexusError::ArithmeticOverflow)?
            .checked_div(usd_value as u128)
            .ok_or(NexusError::ArithmeticOverflow)?) as u64
    } else {
        0u64
    };

    let treasury_amount = collateral_amount
        .checked_sub(importer_refund_amount)
        .ok_or(NexusError::ArithmeticOverflow)?;

    let mint_decimals = ctx.accounts.collateral_mint.decimals;

    // Seeds for escrow PDA signing
    let escrow_id_bytes = escrow_id.as_bytes().to_vec();
    let bump = escrow.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[b"escrow", escrow_id_bytes.as_slice(), &[bump]]];

    // Transfer to treasury
    if treasury_amount > 0 {
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.collateral_vault.to_account_info(),
                    mint: ctx.accounts.collateral_mint.to_account_info(),
                    to: ctx.accounts.treasury_token_account.to_account_info(),
                    authority: escrow.to_account_info(),
                },
                signer_seeds,
            ),
            treasury_amount,
            mint_decimals,
        )?;
    }

    // Refund to importer
    if importer_refund_amount > 0 {
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.collateral_vault.to_account_info(),
                    mint: ctx.accounts.collateral_mint.to_account_info(),
                    to: ctx.accounts.importer_refund_account.to_account_info(),
                    authority: escrow.to_account_info(),
                },
                signer_seeds,
            ),
            importer_refund_amount,
            mint_decimals,
        )?;
    }

    let now = Clock::get()?.unix_timestamp;

    emit!(CollateralLiquidated {
        escrow_id,
        collateral_amount,
        usd_value_at_liquidation: usd_value,
        timestamp: now,
    });

    // Mark escrow as refunded after liquidation clears it
    escrow.status = EscrowStatus::Refunded;

    Ok(())
}
