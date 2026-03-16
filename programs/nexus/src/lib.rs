use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
pub mod utils;

use instructions::*;
use state::escrow::{ConditionProof, DisputeRuling, FxExecutionParams, TradeParams};
use state::fx_venue::QuoteParams;

declare_id!("NXSvFssBwGNZPpPSS5tcMqQLYbFf8yRKXBiARUdGi7Mb");

#[program]
pub mod nexus {
    use super::*;

    /// Initialize the NEXUS protocol with admin, fee configuration, and KYC registry
    pub fn initialize_protocol(
        ctx: Context<initialize_protocol::InitializeProtocol>,
        fee_bps: u16,
        admin: Pubkey,
        treasury: Pubkey,
    ) -> Result<()> {
        initialize_protocol::handler(ctx, fee_bps, admin, treasury)
    }

    /// Register a new institution with KYC record
    pub fn register_institution(
        ctx: Context<register_institution::RegisterInstitution>,
        institution_id: String,
        wallet: Pubkey,
        kyc_tier: u8,
        jurisdiction: String,
        vasp_id: String,
        expires_at: i64,
    ) -> Result<()> {
        register_institution::handler(
            ctx,
            institution_id,
            wallet,
            kyc_tier,
            jurisdiction,
            vasp_id,
            expires_at,
        )
    }

    /// Create a new escrow with trade conditions and compliance checks
    pub fn create_escrow(
        ctx: Context<create_escrow::CreateEscrow>,
        escrow_id: String,
        deposit_amount: u64,
        params: TradeParams,
        importer_institution_id: String,
    ) -> Result<()> {
        create_escrow::handler(ctx, escrow_id, deposit_amount, params, importer_institution_id)
    }

    /// Fund an escrow by transferring tokens to the PDA vault
    pub fn fund_escrow(
        ctx: Context<fund_escrow::FundEscrow>,
        escrow_id: String,
        amount: u64,
    ) -> Result<()> {
        fund_escrow::handler(ctx, escrow_id, amount)
    }

    /// Submit proof for a condition to mark it satisfied
    pub fn submit_condition(
        ctx: Context<submit_condition::SubmitCondition>,
        escrow_id: String,
        proof: ConditionProof,
    ) -> Result<()> {
        submit_condition::handler(ctx, escrow_id, proof)
    }

    /// Atomically execute FX settlement: escrow release + FX swap in single transaction
    pub fn execute_settlement(
        ctx: Context<execute_settlement::ExecuteSettlement>,
        escrow_id: String,
        log_id: String,
        fx_params: FxExecutionParams,
        originator_name: String,
        originator_account: String,
        beneficiary_name: String,
        beneficiary_account: String,
        transaction_reference: String,
        settlement_start_ms: u64,
    ) -> Result<()> {
        execute_settlement::handler(
            ctx,
            escrow_id,
            log_id,
            fx_params,
            originator_name,
            originator_account,
            beneficiary_name,
            beneficiary_account,
            transaction_reference,
            settlement_start_ms,
        )
    }

    /// Raise a dispute for an escrow (importer only, within dispute window)
    pub fn dispute_escrow(
        ctx: Context<dispute_escrow::DisputeEscrow>,
        escrow_id: String,
        reason: String,
    ) -> Result<()> {
        dispute_escrow::handler(ctx, escrow_id, reason)
    }

    /// Resolve a dispute (admin only)
    pub fn resolve_dispute(
        ctx: Context<resolve_dispute::ResolveDispute>,
        escrow_id: String,
        ruling: DisputeRuling,
    ) -> Result<()> {
        resolve_dispute::handler(ctx, escrow_id, ruling)
    }

    /// Refund escrow after expiry
    pub fn refund_escrow(
        ctx: Context<refund_escrow::RefundEscrow>,
        escrow_id: String,
    ) -> Result<()> {
        refund_escrow::handler(ctx, escrow_id)
    }

    /// Post an RFQ quote to the FX venue (KYC tier 2+ required)
    pub fn post_fx_quote(
        ctx: Context<post_fx_quote::PostFxQuote>,
        params: QuoteParams,
        market_maker_institution_id: String,
    ) -> Result<()> {
        post_fx_quote::handler(ctx, params, market_maker_institution_id)
    }

    /// Cancel an unfilled RFQ quote
    pub fn cancel_fx_quote(
        ctx: Context<cancel_fx_quote::CancelFxQuote>,
        quote_id: String,
    ) -> Result<()> {
        cancel_fx_quote::handler(ctx, quote_id)
    }

    /// Add liquidity to an FX venue pool
    pub fn add_fx_liquidity(
        ctx: Context<add_fx_liquidity::AddFxLiquidity>,
        pool_id: String,
        amount_a: u64,
        amount_b: u64,
        provider_institution_id: String,
    ) -> Result<()> {
        add_fx_liquidity::handler(ctx, pool_id, amount_a, amount_b, provider_institution_id)
    }

    /// Remove liquidity from an FX venue pool
    pub fn remove_fx_liquidity(
        ctx: Context<remove_fx_liquidity::RemoveFxLiquidity>,
        pool_id: String,
        lp_amount: u64,
    ) -> Result<()> {
        remove_fx_liquidity::handler(ctx, pool_id, lp_amount)
    }

    /// Update KYC record tier and expiry (admin only)
    pub fn update_kyc_record(
        ctx: Context<update_kyc_record::UpdateKycRecord>,
        institution_id: String,
        new_tier: u8,
        new_expiry: i64,
        new_aml_risk_score: Option<u8>,
    ) -> Result<()> {
        update_kyc_record::handler(ctx, institution_id, new_tier, new_expiry, new_aml_risk_score)
    }

    /// Revoke a KYC record (admin only)
    pub fn revoke_kyc_record(
        ctx: Context<revoke_kyc_record::RevokeKycRecord>,
        institution_id: String,
    ) -> Result<()> {
        revoke_kyc_record::handler(ctx, institution_id)
    }
}
