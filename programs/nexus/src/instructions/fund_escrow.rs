use crate::{
    errors::NexusError,
    events::EscrowFunded,
    state::escrow::{EscrowAccount, EscrowStatus},
};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

#[derive(Accounts)]
#[instruction(escrow_id: String)]
pub struct FundEscrow<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow_id.as_bytes()],
        bump = escrow.bump,
        constraint = escrow.importer == importer.key() @ NexusError::Unauthorized,
    )]
    pub escrow: Account<'info, EscrowAccount>,

    #[account(
        mut,
        constraint = importer_token_account.owner == importer.key() @ NexusError::Unauthorized,
        constraint = importer_token_account.mint == escrow.token_mint @ NexusError::InvalidFxPair,
    )]
    pub importer_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault", escrow_id.as_bytes()],
        bump,
        constraint = vault_token_account.key() == escrow.vault_token_account @ NexusError::Unauthorized,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub importer: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<FundEscrow>, escrow_id: String, amount: u64) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;

    require!(
        escrow.status == EscrowStatus::Created,
        NexusError::EscrowAlreadyFunded
    );

    let now = Clock::get()?.unix_timestamp;
    require!(!escrow.is_expired(now), NexusError::EscrowExpired);
    require!(amount == escrow.deposit_amount, NexusError::InvalidAmount);

    let mint_decimals = ctx.accounts.token_mint.decimals;

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.importer_token_account.to_account_info(),
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.importer.to_account_info(),
            },
        ),
        amount,
        mint_decimals,
    )?;

    escrow.status = EscrowStatus::Funded;
    escrow.funded_at = Some(now);

    emit!(EscrowFunded {
        escrow_id,
        importer: ctx.accounts.importer.key(),
        amount,
        timestamp: now,
    });

    Ok(())
}
