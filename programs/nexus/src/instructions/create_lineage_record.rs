use crate::{
    errors::NexusError,
    events::LineageRecordCreated,
    state::compliance::{FundLineageRecord, LineageEventType},
    state::config::ProtocolConfig,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(record_id: String, institution_id: String)]
pub struct CreateLineageRecord<'info> {
    #[account(
        seeds = [b"protocol-config"],
        bump = config.bump,
        constraint = config.admin == admin.key() @ NexusError::Unauthorized,
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        init,
        payer = admin,
        space = FundLineageRecord::SPACE,
        seeds = [b"lineage", record_id.as_bytes()],
        bump,
    )]
    pub lineage_record: Account<'info, FundLineageRecord>,

    /// Optional: previous lineage record for this institution (chain linkage).
    /// Pass the system program as a placeholder when there is no previous record.
    /// CHECK: Contents are read to verify institution_id match; PDA derivation is
    ///        verified by the seeds constraint on the caller side.
    pub previous_lineage_record: Option<Account<'info, FundLineageRecord>>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateLineageRecord>,
    record_id: String,
    institution_id: String,
    escrow_id: Option<String>,
    event_type: LineageEventType,
    amount: u64,
    token_mint: Pubkey,
    source_hash: [u8; 32],
    transaction_signature: String,
    attestation: [u8; 64],
) -> Result<()> {
    require!(!ctx.accounts.config.is_paused, NexusError::ProtocolPaused);
    require!(amount > 0, NexusError::InvalidAmount);

    // Attestation must be non-zero (admin must have signed off-chain)
    require!(
        attestation.iter().any(|&b| b != 0),
        NexusError::LineageAttestationMissing
    );

    let now = Clock::get()?.unix_timestamp;

    // Resolve the optional previous record pubkey
    let previous_record_key: Option<Pubkey> =
        if let Some(prev) = &ctx.accounts.previous_lineage_record {
            // Verify the previous record belongs to the same institution
            require!(
                prev.institution_id == institution_id,
                NexusError::InvalidLineageChain
            );
            Some(prev.key())
        } else {
            None
        };

    // Resolve optional escrow pubkey from escrow_id string seed
    let escrow_pubkey: Option<Pubkey> = escrow_id.as_deref().map(|id| {
        Pubkey::find_program_address(&[b"escrow", id.as_bytes()], ctx.program_id).0
    });

    let record = &mut ctx.accounts.lineage_record;
    record.record_id = record_id.clone();
    record.institution_id = institution_id.clone();
    record.wallet = ctx.accounts.admin.key();
    record.escrow = escrow_pubkey;
    record.event_type = event_type.clone();
    record.amount = amount;
    record.token_mint = token_mint;
    record.source_hash = source_hash;
    record.previous_record = previous_record_key;
    record.transaction_signature = transaction_signature;
    record.block_time = now;
    record.attestation = attestation;
    record.bump = ctx.bumps.lineage_record;

    emit!(LineageRecordCreated {
        record_id,
        institution_id,
        wallet: ctx.accounts.admin.key(),
        event_type,
        amount,
        previous_record: previous_record_key,
        timestamp: now,
    });

    Ok(())
}
