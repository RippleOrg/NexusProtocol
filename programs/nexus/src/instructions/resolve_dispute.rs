use crate::{
    errors::NexusError,
    events::DisputeResolved,
    state::{
        config::ProtocolConfig,
        escrow::{DisputeRuling, EscrowAccount, EscrowStatus},
    },
};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

#[derive(Accounts)]
#[instruction(escrow_id: String)]
pub struct ResolveDispute<'info> {
    #[account(
        seeds = [b"protocol-config"],
        bump = config.bump,
        constraint = config.admin == admin.key() @ NexusError::Unauthorized,
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
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub importer_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(
    ctx: Context<ResolveDispute>,
    escrow_id: String,
    ruling: DisputeRuling,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let escrow_account_info = ctx.accounts.escrow.to_account_info();
    let escrow = &mut ctx.accounts.escrow;

    require!(
        escrow.status == EscrowStatus::InDispute,
        NexusError::EscrowNotInDispute
    );

    let ruling_u8 = match ruling {
        DisputeRuling::ExporterWins => 0,
        DisputeRuling::ImporterWins => 1,
    };

    match ruling {
        DisputeRuling::ExporterWins => {
            // Proceed to settlement — set back to ConditionsSatisfied with dispute window reset
            escrow.status = EscrowStatus::ConditionsSatisfied;
            escrow.dispute_window_hours = 0; // bypass dispute window
        }
        DisputeRuling::ImporterWins => {
            // Refund importer
            let amount = escrow.deposit_amount;
            let escrow_id_bytes = escrow.escrow_id.clone();
            let escrow_bump = escrow.bump;
            let token_mint_decimals = ctx.accounts.token_mint.decimals;

            let seeds = &[
                b"escrow".as_ref(),
                escrow_id_bytes.as_bytes(),
                &[escrow_bump],
            ];
            let signer_seeds = &[seeds.as_ref()];

            transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    TransferChecked {
                        from: ctx.accounts.vault_token_account.to_account_info(),
                        mint: ctx.accounts.token_mint.to_account_info(),
                        to: ctx.accounts.importer_token_account.to_account_info(),
                        authority: escrow_account_info,
                    },
                    signer_seeds,
                ),
                amount,
                token_mint_decimals,
            )?;

            escrow.status = EscrowStatus::Refunded;
            escrow.released_amount = amount;
        }
    }

    emit!(DisputeResolved {
        escrow_id,
        ruling: ruling_u8,
        resolved_by: ctx.accounts.admin.key(),
        timestamp: now,
    });

    Ok(())
}
