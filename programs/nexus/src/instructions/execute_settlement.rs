use crate::{
    errors::NexusError,
    events::{EscrowSettled, TravelRuleEmitted},
    state::{
        compliance::{KycRecord, TravelRuleLog},
        config::ProtocolConfig,
        escrow::{EscrowAccount, EscrowStatus, FxExecutionMode, FxExecutionParams},
        fx_venue::{FxVenue, RfqQuote},
    },
    utils::{
        compliance::{validate_aml_risk, validate_fx_rate},
        fx::{compute_amm_output, compute_amm_rate, validate_quote, validate_slippage},
        math::{compute_fee, compute_settlement_amount, safe_sub},
    },
};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

#[derive(Accounts)]
#[instruction(escrow_id: String, log_id: String)]
pub struct ExecuteSettlement<'info> {
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

    #[account(
        mut,
        seeds = [b"vault", escrow_id.as_bytes()],
        bump,
        constraint = vault_token_account.key() == escrow.vault_token_account @ NexusError::Unauthorized,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"fx-venue", escrow.token_mint.as_ref(), escrow.settlement_currency_mint.as_ref()],
        bump = fx_venue.bump,
    )]
    pub fx_venue: Account<'info, FxVenue>,

    #[account(
        mut,
        seeds = [b"fx-vault-base", fx_venue.key().as_ref()],
        bump,
    )]
    pub fx_vault_base: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"fx-vault-quote", fx_venue.key().as_ref()],
        bump,
    )]
    pub fx_vault_quote: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = exporter_settlement_account.owner == escrow.exporter @ NexusError::Unauthorized,
        constraint = exporter_settlement_account.mint == escrow.settlement_currency_mint @ NexusError::InvalidFxPair,
    )]
    pub exporter_settlement_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = treasury_account.owner == config.treasury @ NexusError::Unauthorized,
    )]
    pub treasury_account: InterfaceAccount<'info, TokenAccount>,

    pub token_mint: InterfaceAccount<'info, Mint>,
    pub settlement_mint: InterfaceAccount<'info, Mint>,

    #[account(
        seeds = [b"kyc-record", escrow.importer_institution_id.as_bytes()],
        bump = importer_kyc.bump,
    )]
    pub importer_kyc: Account<'info, KycRecord>,

    #[account(
        seeds = [b"kyc-record", escrow.exporter_institution_id.as_bytes()],
        bump = exporter_kyc.bump,
    )]
    pub exporter_kyc: Account<'info, KycRecord>,

    #[account(
        init,
        payer = settler,
        space = TravelRuleLog::SPACE,
        seeds = [b"travel-rule-log", log_id.as_bytes()],
        bump
    )]
    pub travel_rule_log: Account<'info, TravelRuleLog>,

    #[account(mut)]
    pub settler: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<ExecuteSettlement>,
    escrow_id: String,
    log_id: String,
    fx_params: FxExecutionParams,
    originator_name: String,
    originator_account_str: String,
    beneficiary_name: String,
    beneficiary_account_str: String,
    transaction_reference: String,
    settlement_start_ms: u64,
) -> Result<()> {
    require!(!ctx.accounts.config.is_paused, NexusError::ProtocolPaused);

    let now = Clock::get()?.unix_timestamp;
    let escrow = &ctx.accounts.escrow;

    // Status must be ConditionsSatisfied
    require!(
        escrow.status == EscrowStatus::ConditionsSatisfied,
        NexusError::NotAllConditionsSatisfied
    );

    // Check dispute window has expired
    let conditions_sat_at = escrow
        .conditions_satisfied_at()
        .unwrap_or(escrow.funded_at.unwrap_or(escrow.created_at));
    let dispute_window_end =
        conditions_sat_at + (escrow.dispute_window_hours as i64 * 3600);
    require!(now > dispute_window_end, NexusError::DisputeWindowActive);

    // Re-check AML for both parties
    validate_aml_risk(ctx.accounts.importer_kyc.aml_risk_score)?;
    validate_aml_risk(ctx.accounts.exporter_kyc.aml_risk_score)?;

    // Validate FX venue is active and rate is fresh
    require!(ctx.accounts.fx_venue.is_active, NexusError::VenueNotActive);
    crate::utils::fx::validate_rate_freshness(
        ctx.accounts.fx_venue.six_bfi_updated_at,
        now,
    )?;

    // Validate FX rate within band of SIX BFI reference
    let fx_venue = &ctx.accounts.fx_venue;
    let deposit_amount = escrow.deposit_amount;
    let escrow_bump = escrow.bump;
    let escrow_id_bytes = escrow.escrow_id.clone();
    let importer_key = escrow.importer;
    let exporter_key = escrow.exporter;
    let token_mint_key = escrow.token_mint;
    let settlement_currency_key = escrow.settlement_currency_mint;
    let importer_inst_id = escrow.importer_institution_id.clone();
    let exporter_inst_id = escrow.exporter_institution_id.clone();
    let source_of_funds = escrow.source_of_funds_hash;
    let dispute_window_hours = escrow.dispute_window_hours;

    // Compute settlement amount using AMM rate from venue
    let effective_rate = compute_amm_rate(
        fx_venue.total_base_liquidity,
        fx_venue.total_quote_liquidity,
    )?;

    validate_fx_rate(
        effective_rate,
        fx_venue.six_bfi_rate,
        escrow.fx_rate_band_bps.max(fx_venue.max_rate_deviation_bps),
    )?;

    validate_slippage(effective_rate, fx_venue.six_bfi_rate, fx_params.max_slippage_bps)?;

    // Compute output amount (settlement tokens)
    let settlement_amount_before_fee = compute_amm_output(
        deposit_amount,
        fx_venue.total_base_liquidity,
        fx_venue.total_quote_liquidity,
        fx_venue.fee_bps,
    )?;

    require!(
        settlement_amount_before_fee > 0,
        NexusError::InsufficientLiquidity
    );

    // Deduct protocol fee from settlement
    let protocol_fee = compute_fee(settlement_amount_before_fee, ctx.accounts.config.fee_bps)?;
    let final_settlement_amount = safe_sub(settlement_amount_before_fee, protocol_fee)?;
    require!(final_settlement_amount > 0, NexusError::InvalidAmount);

    let token_mint_decimals = ctx.accounts.token_mint.decimals;
    let settlement_mint_decimals = ctx.accounts.settlement_mint.decimals;

    // ═══════════════════════════════════════
    // ATOMIC EXECUTION BEGIN
    // Step 1: Transfer base tokens from vault to FX venue base vault
    // ═══════════════════════════════════════
    let escrow_seeds = &[
        b"escrow".as_ref(),
        escrow_id_bytes.as_bytes(),
        &[escrow_bump],
    ];
    let escrow_signer_seeds = &[escrow_seeds.as_ref()];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault_token_account.to_account_info(),
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.fx_vault_base.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            },
            escrow_signer_seeds,
        ),
        deposit_amount,
        token_mint_decimals,
    )?;

    // ═══════════════════════════════════════
    // Step 2: Transfer settlement tokens to exporter
    // ═══════════════════════════════════════
    let fx_venue_seeds = &[
        b"fx-venue".as_ref(),
        token_mint_key.as_ref(),
        settlement_currency_key.as_ref(),
        &[ctx.accounts.fx_venue.bump],
    ];
    let fx_venue_signer_seeds = &[fx_venue_seeds.as_ref()];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.fx_vault_quote.to_account_info(),
                mint: ctx.accounts.settlement_mint.to_account_info(),
                to: ctx.accounts.exporter_settlement_account.to_account_info(),
                authority: ctx.accounts.fx_venue.to_account_info(),
            },
            fx_venue_signer_seeds,
        ),
        final_settlement_amount,
        settlement_mint_decimals,
    )?;

    // ═══════════════════════════════════════
    // Step 3: Transfer protocol fee to treasury
    // ═══════════════════════════════════════
    if protocol_fee > 0 {
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.fx_vault_quote.to_account_info(),
                    mint: ctx.accounts.settlement_mint.to_account_info(),
                    to: ctx.accounts.treasury_account.to_account_info(),
                    authority: ctx.accounts.fx_venue.to_account_info(),
                },
                fx_venue_signer_seeds,
            ),
            protocol_fee,
            settlement_mint_decimals,
        )?;
    }

    // ═══════════════════════════════════════
    // Update FX venue liquidity
    // ═══════════════════════════════════════
    let fx_venue_mut = &mut ctx.accounts.fx_venue;
    fx_venue_mut.total_base_liquidity = fx_venue_mut
        .total_base_liquidity
        .checked_add(deposit_amount)
        .ok_or(NexusError::ArithmeticOverflow)?;
    fx_venue_mut.total_quote_liquidity = fx_venue_mut
        .total_quote_liquidity
        .checked_sub(settlement_amount_before_fee)
        .ok_or(NexusError::ArithmeticOverflow)?;

    // ═══════════════════════════════════════
    // Update escrow state
    // ═══════════════════════════════════════
    let escrow_mut = &mut ctx.accounts.escrow;
    escrow_mut.status = EscrowStatus::Settled;
    escrow_mut.released_amount = deposit_amount;
    escrow_mut.settled_at = Some(now);

    // ═══════════════════════════════════════
    // Create TravelRuleLog on-chain
    // ═══════════════════════════════════════
    let travel_log = &mut ctx.accounts.travel_rule_log;
    travel_log.log_id = log_id.clone();
    travel_log.escrow = ctx.accounts.escrow.key();
    travel_log.originator_institution_id = importer_inst_id.clone();
    travel_log.originator_wallet = importer_key;
    travel_log.originator_name = originator_name;
    travel_log.originator_account = originator_account_str;
    travel_log.beneficiary_institution_id = exporter_inst_id.clone();
    travel_log.beneficiary_wallet = exporter_key;
    travel_log.beneficiary_name = beneficiary_name;
    travel_log.beneficiary_account = beneficiary_account_str;
    travel_log.transfer_amount = deposit_amount;
    travel_log.token_mint = token_mint_key;
    travel_log.transaction_reference = transaction_reference;
    travel_log.created_at = now;
    travel_log.bump = ctx.bumps.travel_rule_log;

    // ═══════════════════════════════════════
    // Compute settlement time in ms
    // ═══════════════════════════════════════
    let now_ms = (now as u64).saturating_mul(1000);
    let settlement_ms = now_ms.saturating_sub(settlement_start_ms);

    emit!(TravelRuleEmitted {
        log_id: log_id.clone(),
        escrow: ctx.accounts.escrow.key(),
        transfer_amount: deposit_amount,
        originator_institution_id: importer_inst_id,
        beneficiary_institution_id: exporter_inst_id,
        timestamp: now,
    });

    emit!(EscrowSettled {
        escrow_id,
        importer: importer_key,
        exporter: exporter_key,
        base_amount: deposit_amount,
        fx_rate: effective_rate,
        settlement_amount: final_settlement_amount,
        settlement_currency: settlement_currency_key,
        settlement_ms,
        travel_rule_log: ctx.accounts.travel_rule_log.key(),
        timestamp: now,
    });

    Ok(())
}
