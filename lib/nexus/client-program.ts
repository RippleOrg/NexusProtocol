"use client";

import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  type Transaction as LegacyTransaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { nexusIdl } from "@/lib/nexus/idl";
import {
  SOLANA_RPC_URL,
  USDC_MINT,
} from "@/lib/nexus/constants";
import {
  deriveEscrowPda,
  deriveKycRecordPda,
  deriveProtocolConfigPda,
  deriveTravelRuleLogPda,
  deriveVaultPda,
} from "@/lib/nexus/onchain";
import type {
  CreateEscrowInput,
  InstitutionDirectoryItem,
} from "@/lib/nexus/types";
import type { Nexus } from "@/target/types/nexus";

type AnchorWallet = ConstructorParameters<typeof AnchorProvider>[1];

export interface NexusSolanaWalletLike {
  address?: string | null;
  signTransaction: NonNullable<WalletContextState["signTransaction"]>;
  signAllTransactions?: NonNullable<WalletContextState["signAllTransactions"]>;
}

export interface EscrowCreationProgress {
  step:
    | "preflight"
    | "ata_approval"
    | "ata_confirmed"
    | "create_approval"
    | "create_confirmed"
    | "fund_approval"
    | "fund_confirmed";
  label: string;
  signature?: string;
}

function createAnchorWallet(
  owner: PublicKey,
  wallet: NexusSolanaWalletLike
): AnchorWallet {
  return {
    publicKey: owner,
    signTransaction: async (transaction) =>
      (await wallet.signTransaction(transaction)) as typeof transaction,
    signAllTransactions: async (transactions) => {
      if (wallet.signAllTransactions) {
        return (await wallet.signAllTransactions(transactions)) as typeof transactions;
      }

      return Promise.all(
        transactions.map(
          async (transaction) =>
            (await wallet.signTransaction(transaction)) as (typeof transactions)[number]
        )
      ) as Promise<typeof transactions>;
    },
  };
}

function hexToBytes(hex: string) {
  const bytes: number[] = [];

  for (let index = 0; index < hex.length; index += 2) {
    bytes.push(Number.parseInt(hex.slice(index, index + 2), 16));
  }

  return bytes;
}

function mapConditionType(conditionType: CreateEscrowInput["conditions"][number]["conditionType"]) {
  switch (conditionType) {
    case "DocumentHash":
      return { documentHash: {} };
    case "OracleConfirm":
      return { oracleConfirm: {} };
    case "TimeBased":
      return { timeBased: {} };
    case "ManualApproval":
      return { manualApproval: {} };
    case "MultiSigApproval":
      return { multiSigApproval: {} };
    default:
      return { manualApproval: {} };
  }
}

function randomSeed(prefix: string) {
  return `${prefix}${crypto.randomUUID().replace(/-/g, "").slice(0, 21)}`;
}

export async function createAndFundEscrowOnChain(params: {
  wallet: NexusSolanaWalletLike;
  importerInstitutionId: string;
  counterparty: InstitutionDirectoryItem;
  trade: CreateEscrowInput;
  onStatusChange?: (progress: EscrowCreationProgress) => void;
}) {
  const {
    wallet,
    importerInstitutionId,
    counterparty,
    trade,
    onStatusChange,
  } = params;
  const walletAddress = wallet.address;

  if (!walletAddress) {
    throw new Error("Connect a primary wallet before creating a trade");
  }

  const owner = new PublicKey(walletAddress);
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const provider = new AnchorProvider(
    connection,
    createAnchorWallet(owner, wallet),
    AnchorProvider.defaultOptions()
  );
  const program = new Program<Nexus>(nexusIdl, provider);

  const escrowId = randomSeed("ESC");
  const travelRuleLogId = randomSeed("TRL");
  const config = new PublicKey(deriveProtocolConfigPda());
  const escrow = new PublicKey(deriveEscrowPda(escrowId));
  const vaultTokenAccount = new PublicKey(deriveVaultPda(escrowId));
  const importerKyc = new PublicKey(deriveKycRecordPda(importerInstitutionId));
  const exporterKyc = new PublicKey(
    deriveKycRecordPda(counterparty.onChainInstitutionId)
  );
  const tokenMint = new PublicKey(USDC_MINT);
  const settlementMint = new PublicKey(trade.settlementInstrument);
  const importerTokenAccount = getAssociatedTokenAddressSync(tokenMint, owner);
  const notify = (progress: EscrowCreationProgress) => {
    onStatusChange?.(progress);
  };

  notify({
    step: "preflight",
    label: "Preparing wallet and escrow accounts on devnet",
  });

  const existingAta = await connection.getAccountInfo(importerTokenAccount);
  if (!existingAta) {
    const ataTx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        owner,
        importerTokenAccount,
        owner,
        tokenMint
      )
    );
    notify({
      step: "ata_approval",
      label: "Approve the USDC token-account setup in your wallet",
    });
    const ataSignature = await provider.sendAndConfirm(ataTx);
    await connection.confirmTransaction(ataSignature, "confirmed");
    notify({
      step: "ata_confirmed",
      label: "USDC token account confirmed on devnet",
      signature: ataSignature,
    });
  }

  const depositAmountRaw = Math.round(trade.depositAmountUsdc * 1_000_000);
  const sourceOfFundsHash = hexToBytes(trade.sourceOfFundsHash);

  notify({
    step: "create_approval",
    label: "Approve the escrow creation transaction in your wallet",
  });
  const createSignature = await program.methods
    .createEscrow(
      escrowId,
      new BN(depositAmountRaw),
      {
        exporter: new PublicKey(counterparty.wallet),
        exporterInstitutionId: counterparty.onChainInstitutionId,
        settlementCurrencyMint: settlementMint,
        fxRateBandBps: trade.fxRateBandBps,
        conditions: trade.conditions.map((condition) => ({
          conditionType: mapConditionType(condition.conditionType),
          description: condition.description,
          documentHash:
            condition.conditionType === "DocumentHash"
              ? hexToBytes(
                  condition.documentHash?.trim() || trade.sourceOfFundsHash
                )
              : null,
          oracleFeed: null,
          oracleExpectedValue: null,
          deadline: null,
          isSatisfied: false,
          satisfiedAt: null,
          satisfiedBy: null,
          releaseBps: condition.releaseBps,
        })),
        disputeWindowHours: 24,
        expiresAt: new BN(Math.floor(new Date(trade.expiresAt).getTime() / 1000)),
        sourceOfFundsHash,
        travelRuleData: {
          originatorName: trade.travelRule.originatorName,
          originatorAccount: trade.travelRule.originatorAccount,
          beneficiaryName: trade.travelRule.beneficiaryName,
          beneficiaryAccount: trade.travelRule.beneficiaryAccount,
          transactionReference: trade.travelRule.transactionReference,
        },
      },
      importerInstitutionId
    )
    .accountsPartial({
      config,
      escrow,
      vaultTokenAccount,
      tokenMint,
      importerKyc,
      exporterKyc,
      importer: owner,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();
  await connection.confirmTransaction(createSignature, "confirmed");
  notify({
    step: "create_confirmed",
    label: "Escrow instruction confirmed on devnet",
    signature: createSignature,
  });

  notify({
    step: "fund_approval",
    label: "Approve the funding transaction in your wallet",
  });
  const fundSignature = await program.methods
    .fundEscrow(escrowId, new BN(depositAmountRaw))
    .accountsPartial({
      escrow,
      importerTokenAccount,
      vaultTokenAccount,
      tokenMint,
      importer: owner,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  await connection.confirmTransaction(fundSignature, "confirmed");
  notify({
    step: "fund_confirmed",
    label: "Escrow funding confirmed on devnet",
    signature: fundSignature,
  });

  return {
    escrowId,
    travelRuleLogId,
    onChainPda: escrow.toBase58(),
    travelRuleLogPda: deriveTravelRuleLogPda(travelRuleLogId),
    createSignature,
    fundSignature,
  };
}
