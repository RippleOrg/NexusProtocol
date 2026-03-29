use crate::{
    errors::NexusError,
    events::EscrowRefunded,
    state::escrow::{EscrowAccount, EscrowStatus},
};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

#[derive(Accounts)]
#[instruction(escrow_id: String)]
pub struct RefundEscrow<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow_id.as_bytes()],
        bump = escrow.bump,
        constraint = escrow.importer == importer.key() @ NexusError::Unauthorized,
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
        constraint = importer_token_account.owner == importer.key() @ NexusError::Unauthorized,
        constraint = importer_token_account.mint == escrow.token_mint @ NexusError::InvalidFxPair,
    )]
    pub importer_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub importer: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<RefundEscrow>, escrow_id: String) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let escrow_account_info = ctx.accounts.escrow.to_account_info();
    let escrow = &mut ctx.accounts.escrow;

    require!(
        !matches!(escrow.status, EscrowStatus::Settled | EscrowStatus::Refunded),
        NexusError::EscrowAlreadySettled
    );

    // Only funded escrows can be refunded; Created-but-never-funded escrows have no tokens in vault
    require!(
        escrow.funded_at.is_some(),
        NexusError::EscrowNotFunded
    );

    // Refund only allowed after expiry
    require!(now >= escrow.expires_at, NexusError::InvalidTimestamp);

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

    emit!(EscrowRefunded {
        escrow_id,
        importer: ctx.accounts.importer.key(),
        amount,
        timestamp: now,
    });

    Ok(())
}
