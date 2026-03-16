use crate::{
    errors::NexusError,
    events::ConditionSatisfied,
    state::escrow::{ConditionProof, ConditionType, EscrowAccount, EscrowStatus},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(escrow_id: String)]
pub struct SubmitCondition<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow_id.as_bytes()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, EscrowAccount>,

    pub submitter: Signer<'info>,
}

pub fn handler(
    ctx: Context<SubmitCondition>,
    escrow_id: String,
    proof: ConditionProof,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let escrow = &mut ctx.accounts.escrow;

    require!(
        matches!(
            escrow.status,
            EscrowStatus::Funded | EscrowStatus::ConditionsPartial
        ),
        NexusError::EscrowNotFunded
    );

    require!(!escrow.is_expired(now), NexusError::EscrowExpired);

    let idx = proof.condition_index as usize;
    require!(idx < escrow.conditions.len(), NexusError::ConditionIndexOutOfBounds);

    // Check not already satisfied
    let mask = 1u8 << idx;
    require!(
        escrow.conditions_satisfied & mask == 0,
        NexusError::ConditionAlreadySatisfied
    );

    let condition = &escrow.conditions[idx].clone();

    // Verify condition deadline if set
    if let Some(deadline) = condition.deadline {
        require!(now <= deadline, NexusError::EscrowExpired);
    }

    // Validate proof based on condition type
    match condition.condition_type {
        ConditionType::DocumentHash => {
            let proof_hash = proof
                .document_hash
                .ok_or(NexusError::ConditionProofInvalid)?;
            let expected_hash = condition
                .document_hash
                .ok_or(NexusError::ConditionProofInvalid)?;
            require!(proof_hash == expected_hash, NexusError::DocumentHashMismatch);
        }
        ConditionType::OracleConfirm => {
            let oracle_val = proof
                .oracle_value
                .ok_or(NexusError::ConditionProofInvalid)?;
            let expected_val = condition
                .oracle_expected_value
                .ok_or(NexusError::ConditionProofInvalid)?;
            require!(oracle_val == expected_val, NexusError::OracleValueMismatch);
        }
        ConditionType::TimeBased => {
            // Time-based condition: just check deadline has passed (or current time is valid)
            if let Some(deadline) = condition.deadline {
                require!(now >= deadline, NexusError::ConditionProofInvalid);
            }
        }
        ConditionType::ManualApproval => {
            // Manual approval: submitter must be either importer, exporter, or designated approver
            require!(
                ctx.accounts.submitter.key() == escrow.importer
                    || ctx.accounts.submitter.key() == escrow.exporter,
                NexusError::Unauthorized
            );
        }
        ConditionType::MultiSigApproval => {
            require!(
                !proof.approver_signatures.is_empty(),
                NexusError::ConditionProofInvalid
            );
        }
    }

    // Mark condition satisfied
    let condition_type_u8 = match condition.condition_type {
        ConditionType::DocumentHash => 0,
        ConditionType::OracleConfirm => 1,
        ConditionType::TimeBased => 2,
        ConditionType::MultiSigApproval => 3,
        ConditionType::ManualApproval => 4,
    };

    escrow.conditions[idx].is_satisfied = true;
    escrow.conditions[idx].satisfied_at = Some(now);
    escrow.conditions[idx].satisfied_by = Some(ctx.accounts.submitter.key());
    escrow.conditions_satisfied |= mask;

    // Update escrow status
    if escrow.all_conditions_satisfied() {
        escrow.status = EscrowStatus::ConditionsSatisfied;
    } else {
        escrow.status = EscrowStatus::ConditionsPartial;
    }

    emit!(ConditionSatisfied {
        escrow_id,
        condition_index: proof.condition_index,
        condition_type: condition_type_u8,
        satisfied_by: ctx.accounts.submitter.key(),
        timestamp: now,
    });

    Ok(())
}
