use crate::{
    errors::NexusError,
    events::EscrowCreated,
    state::{
        compliance::KycRecord,
        config::ProtocolConfig,
        escrow::{EscrowAccount, EscrowStatus, TradeParams},
    },
    utils::compliance::{validate_kyc, validate_travel_rule},
};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
#[instruction(
    escrow_id: String,
    deposit_amount: u64,
    params: TradeParams,
    importer_institution_id: String
)]
pub struct CreateEscrow<'info> {
    #[account(
        seeds = [b"protocol-config"],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        init,
        payer = importer,
        space = EscrowAccount::SPACE,
        seeds = [b"escrow", escrow_id.as_bytes()],
        bump
    )]
    pub escrow: Account<'info, EscrowAccount>,

    /// CHECK: The vault token account is created by the client and verified by seeds
    #[account(
        init,
        payer = importer,
        token::mint = token_mint,
        token::authority = escrow,
        seeds = [b"vault", escrow_id.as_bytes()],
        bump
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        seeds = [b"kyc-record", importer_institution_id.as_bytes()],
        bump = importer_kyc.bump,
    )]
    pub importer_kyc: Account<'info, KycRecord>,

    #[account(
        seeds = [b"kyc-record", params.exporter_institution_id.as_bytes()],
        bump = exporter_kyc.bump,
    )]
    pub exporter_kyc: Account<'info, KycRecord>,

    #[account(mut)]
    pub importer: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<CreateEscrow>,
    escrow_id: String,
    deposit_amount: u64,
    params: TradeParams,
    importer_institution_id: String,
) -> Result<()> {
    require!(!ctx.accounts.config.is_paused, NexusError::ProtocolPaused);
    require!(deposit_amount > 0, NexusError::InvalidAmount);
    require!(escrow_id.len() <= EscrowAccount::MAX_ESCROW_ID_LEN, NexusError::InvalidAmount);
    require!(
        params.conditions.len() <= EscrowAccount::MAX_CONDITIONS,
        NexusError::MaxConditionsReached
    );

    let now = Clock::get()?.unix_timestamp;
    require!(params.expires_at > now, NexusError::InvalidTimestamp);

    // Validate KYC for both parties
    validate_kyc(&ctx.accounts.importer_kyc, 1, now)?;
    validate_kyc(&ctx.accounts.exporter_kyc, 1, now)?;

    // Verify importer wallet matches KYC record
    require!(
        ctx.accounts.importer_kyc.wallet == ctx.accounts.importer.key(),
        NexusError::Unauthorized
    );

    // Travel Rule check
    validate_travel_rule(
        deposit_amount,
        !params.travel_rule_data.originator_name.is_empty(),
        params.travel_rule_data.is_populated(),
    )?;

    // Validate release_bps sum
    let total_bps: u16 = params.conditions.iter()
        .map(|c| c.release_bps)
        .fold(0u16, |a, b| a.saturating_add(b));
    // Allow 0 (single release) or exactly 10000
    require!(
        total_bps == 0 || total_bps == 10_000,
        NexusError::InvalidAmount
    );

    let travel_rule_attached = params.travel_rule_data.is_populated();

    let escrow = &mut ctx.accounts.escrow;
    escrow.escrow_id = escrow_id.clone();
    escrow.importer = ctx.accounts.importer.key();
    escrow.exporter = params.exporter;
    escrow.importer_institution_id = importer_institution_id;
    escrow.exporter_institution_id = params.exporter_institution_id.clone();
    escrow.token_mint = ctx.accounts.token_mint.key();
    escrow.vault_token_account = ctx.accounts.vault_token_account.key();
    escrow.deposit_amount = deposit_amount;
    escrow.released_amount = 0;
    escrow.settlement_currency_mint = params.settlement_currency_mint;
    escrow.fx_rate_band_bps = params.fx_rate_band_bps;
    escrow.conditions = params.conditions;
    escrow.conditions_satisfied = 0;
    escrow.status = EscrowStatus::Created;
    escrow.dispute_window_hours = params.dispute_window_hours;
    escrow.dispute_raised_at = None;
    escrow.created_at = now;
    escrow.funded_at = None;
    escrow.settled_at = None;
    escrow.expires_at = params.expires_at;
    escrow.travel_rule_attached = travel_rule_attached;
    escrow.source_of_funds_hash = params.source_of_funds_hash;
    escrow.bump = ctx.bumps.escrow;

    emit!(EscrowCreated {
        escrow_id,
        importer: ctx.accounts.importer.key(),
        exporter: params.exporter,
        amount: deposit_amount,
        token_mint: ctx.accounts.token_mint.key(),
        conditions_count: escrow.conditions.len() as u8,
        expires_at: params.expires_at,
        timestamp: now,
    });

    Ok(())
}
