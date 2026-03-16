use crate::{
    errors::NexusError,
    events::DisputeRaised,
    state::escrow::{EscrowAccount, EscrowStatus},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(escrow_id: String)]
pub struct DisputeEscrow<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow_id.as_bytes()],
        bump = escrow.bump,
        constraint = escrow.importer == importer.key() @ NexusError::UnauthorizedDispute,
    )]
    pub escrow: Account<'info, EscrowAccount>,

    pub importer: Signer<'info>,
}

pub fn handler(
    ctx: Context<DisputeEscrow>,
    escrow_id: String,
    reason: String,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let escrow = &mut ctx.accounts.escrow;

    // Must be in ConditionsSatisfied status
    require!(
        escrow.status == EscrowStatus::ConditionsSatisfied,
        NexusError::InvalidEscrowStatus
    );

    // Check we're within the dispute window
    let conditions_sat_at = escrow
        .conditions_satisfied_at()
        .unwrap_or(escrow.funded_at.unwrap_or(escrow.created_at));
    let dispute_window_end =
        conditions_sat_at + (escrow.dispute_window_hours as i64 * 3600);
    require!(now <= dispute_window_end, NexusError::DisputeWindowExpired);

    escrow.status = EscrowStatus::InDispute;
    escrow.dispute_raised_at = Some(now);

    emit!(DisputeRaised {
        escrow_id,
        importer: ctx.accounts.importer.key(),
        reason,
        timestamp: now,
    });

    Ok(())
}
