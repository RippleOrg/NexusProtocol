use crate::{
    errors::NexusError,
    events::LineageChainVerified,
    state::compliance::FundLineageRecord,
    state::config::ProtocolConfig,
};
use anchor_lang::prelude::*;

/// Verifies a lineage chain by traversing `remaining_accounts` (ordered from
/// oldest to newest record) and checking:
///   1. Each record's `previous_record` links correctly to the preceding entry.
///   2. Each record's `institution_id` matches the requested institution.
///   3. Each record's `attestation` field is non-zero (admin-signed off-chain).
///
/// The first account in `remaining_accounts` must correspond to `start_record`
/// and the last must correspond to `end_record`.
///
/// Emits `LineageChainVerified` with chain length and total value.
#[derive(Accounts)]
pub struct VerifyLineageChain<'info> {
    #[account(seeds = [b"protocol-config"], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
}

pub fn handler(
    ctx: Context<VerifyLineageChain>,
    institution_id: String,
    start_record: Pubkey,
    end_record: Pubkey,
) -> Result<()> {
    require!(!ctx.accounts.config.is_paused, NexusError::ProtocolPaused);

    let chain_accounts = ctx.remaining_accounts;
    require!(!chain_accounts.is_empty(), NexusError::InvalidLineageChain);

    // Verify first record is `start_record`
    require!(
        chain_accounts[0].key() == start_record,
        NexusError::InvalidLineageChain
    );
    // Verify last record is `end_record`
    require!(
        chain_accounts[chain_accounts.len() - 1].key() == end_record,
        NexusError::InvalidLineageChain
    );

    let mut total_value: u64 = 0;

    for (i, account_info) in chain_accounts.iter().enumerate() {
        // Deserialize as FundLineageRecord
        let record: FundLineageRecord =
            FundLineageRecord::try_deserialize(&mut account_info.try_borrow_data()?.as_ref())?;

        // Verify institution ownership
        require!(
            record.institution_id == institution_id,
            NexusError::InvalidLineageChain
        );

        // Verify attestation is non-zero
        require!(
            record.attestation.iter().any(|&b| b != 0),
            NexusError::LineageAttestationMissing
        );

        // Verify linked-list linkage
        if i == 0 {
            // The first record in the range may have a previous_record pointing
            // outside the verified window — that's acceptable.
        } else {
            // Each subsequent record must point back to the previous account
            require!(
                record.previous_record == Some(chain_accounts[i - 1].key()),
                NexusError::InvalidLineageChain
            );
        }

        total_value = total_value
            .checked_add(record.amount)
            .ok_or(NexusError::ArithmeticOverflow)?;
    }

    let chain_length = chain_accounts.len() as u32;
    let now = Clock::get()?.unix_timestamp;

    emit!(LineageChainVerified {
        institution_id,
        start_record,
        end_record,
        chain_length,
        total_value,
        timestamp: now,
    });

    Ok(())
}
