import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { requireWalletSession } from "@/lib/server/wallet-auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { listOnChainEscrowRecords } from "@/lib/server/onchain-escrows";
import { serialiseEscrow } from "@/lib/server/nexus-data";
import { getAdminProgramContext } from "@/lib/server/nexus-admin";
import { deriveEscrowPda, deriveTravelRuleLogPda } from "@/lib/nexus/onchain";
import { getSettlementInstrumentByCode } from "@/lib/nexus/constants";

const ConditionSchema = z.object({
  conditionType: z.enum([
    "DocumentHash",
    "OracleConfirm",
    "TimeBased",
    "ManualApproval",
    "MultiSigApproval",
  ]),
  description: z.string().min(4).max(128),
  documentHash: z.string().max(128).optional(),
  releaseBps: z.number().int().min(0).max(10_000),
});

const CreateEscrowSchema = z.object({
  counterpartyInstitutionId: z.string().min(1),
  depositAmountUsdc: z.number().positive(),
  settlementInstrument: z.string().min(3).max(64),
  fxPair: z.string().min(6).max(16),
  fxRateReference: z.number().positive(),
  fxRateBandBps: z.number().int().min(10).max(500),
  expiresAt: z.string().datetime(),
  sourceOfFundsHash: z.string().regex(/^[a-fA-F0-9]{64}$/),
  conditions: z.array(ConditionSchema).min(1).max(10),
  travelRule: z.object({
    originatorName: z.string().min(2).max(64),
    originatorAccount: z.string().min(2).max(64),
    beneficiaryName: z.string().min(2).max(64),
    beneficiaryAccount: z.string().min(2).max(64),
    transactionReference: z.string().min(4).max(64),
  }),
  escrowSeed: z.string().min(1).max(32),
  onChainPda: z.string().min(32).max(64),
  travelRuleSeed: z.string().min(1).max(32).optional(),
  travelRuleLogPda: z.string().min(32).max(64).optional(),
  createSignature: z.string().min(32).optional(),
  fundSignature: z.string().min(32).optional(),
});

function mapEscrowStatus(
  status: Record<string, unknown> | null | undefined
): string {
  const key = Object.keys(status ?? {})[0] ?? "created";

  switch (key) {
    case "created":
      return "Created";
    case "funded":
      return "Funded";
    case "conditionsPartial":
      return "ConditionsPartial";
    case "conditionsSatisfied":
      return "ConditionsSatisfied";
    case "inDispute":
      return "InDispute";
    case "settled":
      return "Settled";
    case "refunded":
      return "Refunded";
    case "expired":
      return "Expired";
    default:
      return "Created";
  }
}

function unixTimestampToDate(
  value: { toNumber(): number } | number | bigint | null | undefined
) {
  if (value == null) {
    return null;
  }

  const seconds =
    typeof value === "number"
      ? value
      : typeof value === "bigint"
        ? Number(value)
        : value.toNumber();

  return new Date(seconds * 1000);
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const status = /Missing wallet address|Invalid wallet address/i.test(message)
    ? 401
    : /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|failed to get|All Solana RPC providers failed/i.test(
          message
        )
      ? 503
    : 500;

  return NextResponse.json({ error: message }, { status });
}

async function loadCurrentInstitution(req: NextRequest) {
  const session = await requireWalletSession(req);
  const prisma = await getPrismaClient();

  const institution = await prisma.institution.findFirst({
    where: {
      wallet: session.walletAddress,
    },
  });

  return { prisma, institution };
}

export async function GET(req: NextRequest) {
  try {
    await requireWalletSession(req);
    const escrows = await listOnChainEscrowRecords();

    return NextResponse.json({ escrows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { prisma, institution } = await loadCurrentInstitution(req);

    if (!institution?.onboardingCompletedAt) {
      return NextResponse.json(
        { error: "Complete institution onboarding before creating trades" },
        { status: 403 }
      );
    }

    const body = (await req.json()) as unknown;
    const parsed = CreateEscrowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid trade payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const counterparty = await prisma.institution.findUnique({
      where: { id: payload.counterpartyInstitutionId },
    });

    if (!counterparty?.onboardingCompletedAt) {
      return NextResponse.json(
        { error: "Selected counterparty is not ready for settlement" },
        { status: 400 }
      );
    }

    if (counterparty.id === institution.id) {
      return NextResponse.json(
        { error: "Counterparty must be different from your institution" },
        { status: 400 }
      );
    }

    const currentInstitutionOnChainId = institution.lei ?? institution.id;
    const counterpartyOnChainId = counterparty.lei ?? counterparty.id;
    const derivedEscrowPda = deriveEscrowPda(payload.escrowSeed);
    const derivedTravelRuleLogPda = payload.travelRuleSeed
      ? deriveTravelRuleLogPda(payload.travelRuleSeed)
      : payload.travelRuleLogPda ?? null;
    const resolvedSettlementInstrument =
      getSettlementInstrumentByCode(payload.settlementInstrument);
    const expectedSettlementMint =
      resolvedSettlementInstrument?.settlementMint ?? payload.settlementInstrument;

    if (payload.onChainPda !== derivedEscrowPda) {
      return NextResponse.json(
        { error: "Escrow PDA does not match the submitted escrow seed" },
        { status: 400 }
      );
    }

    if (
      payload.travelRuleLogPda &&
      derivedTravelRuleLogPda &&
      payload.travelRuleLogPda !== derivedTravelRuleLogPda
    ) {
      return NextResponse.json(
        { error: "Travel-rule PDA does not match the submitted travel-rule seed" },
        { status: 400 }
      );
    }

    const { program } = await getAdminProgramContext();
    const onChainEscrow = await program.account.escrowAccount.fetchNullable(
      new PublicKey(payload.onChainPda)
    );

    if (!onChainEscrow) {
      return NextResponse.json(
        { error: "The submitted escrow was not found on-chain" },
        { status: 409 }
      );
    }

    if (onChainEscrow.importerInstitutionId !== currentInstitutionOnChainId) {
      return NextResponse.json(
        { error: "On-chain importer does not match the authenticated institution" },
        { status: 403 }
      );
    }

    if (onChainEscrow.exporterInstitutionId !== counterpartyOnChainId) {
      return NextResponse.json(
        { error: "On-chain exporter does not match the selected counterparty" },
        { status: 400 }
      );
    }

    if (
      onChainEscrow.settlementCurrencyMint.toBase58() !== expectedSettlementMint
    ) {
      return NextResponse.json(
        { error: "On-chain settlement mint does not match the selected corridor" },
        { status: 400 }
      );
    }

    const depositAmount = BigInt(onChainEscrow.depositAmount.toString());
    const created = await prisma.escrow.upsert({
      where: { onChainPda: payload.onChainPda },
      create: {
        escrowSeed: payload.escrowSeed,
        onChainPda: payload.onChainPda,
        importerInstitutionId: institution.id,
        exporterInstitutionId: counterparty.id,
        depositAmount,
        tokenMint: onChainEscrow.tokenMint.toBase58(),
        settlementMint: onChainEscrow.settlementCurrencyMint.toBase58(),
        status: mapEscrowStatus(onChainEscrow.status),
        conditionsTotal: onChainEscrow.conditions.length,
        conditionsSatisfied: onChainEscrow.conditions.filter(
          (condition: { isSatisfied: boolean }) => condition.isSatisfied
        ).length,
        fxRate: payload.fxRateReference,
        travelRuleLogPda: payload.travelRuleLogPda ?? derivedTravelRuleLogPda,
        sourceOfFundsHash: payload.sourceOfFundsHash.toLowerCase(),
        expiresAt: unixTimestampToDate(onChainEscrow.expiresAt) ?? new Date(payload.expiresAt),
        settledAt: unixTimestampToDate(onChainEscrow.settledAt),
      },
      update: {
        escrowSeed: payload.escrowSeed,
        importerInstitutionId: institution.id,
        exporterInstitutionId: counterparty.id,
        depositAmount,
        tokenMint: onChainEscrow.tokenMint.toBase58(),
        settlementMint: onChainEscrow.settlementCurrencyMint.toBase58(),
        status: mapEscrowStatus(onChainEscrow.status),
        conditionsTotal: onChainEscrow.conditions.length,
        conditionsSatisfied: onChainEscrow.conditions.filter(
          (condition: { isSatisfied: boolean }) => condition.isSatisfied
        ).length,
        fxRate: payload.fxRateReference,
        travelRuleLogPda: payload.travelRuleLogPda ?? derivedTravelRuleLogPda,
        sourceOfFundsHash: payload.sourceOfFundsHash.toLowerCase(),
        expiresAt: unixTimestampToDate(onChainEscrow.expiresAt) ?? new Date(payload.expiresAt),
        settledAt: unixTimestampToDate(onChainEscrow.settledAt),
      },
      include: {
        importer: true,
        exporter: true,
      },
    });

    if (payload.travelRuleLogPda ?? derivedTravelRuleLogPda) {
      await prisma.travelRuleLog.upsert({
        where: {
          onChainLogPda: payload.travelRuleLogPda ?? derivedTravelRuleLogPda!,
        },
        create: {
          onChainLogPda: payload.travelRuleLogPda ?? derivedTravelRuleLogPda!,
          escrowId: created.id,
          originatorInstitutionId: institution.id,
          originatorName: payload.travelRule.originatorName,
          originatorAccount: payload.travelRule.originatorAccount,
          beneficiaryInstitutionId: counterparty.id,
          beneficiaryName: payload.travelRule.beneficiaryName,
          beneficiaryAccount: payload.travelRule.beneficiaryAccount,
          transferAmount: depositAmount,
          currency: "USDC",
          transactionHash: payload.fundSignature ?? payload.createSignature ?? null,
        },
        update: {
          escrowId: created.id,
          originatorInstitutionId: institution.id,
          originatorName: payload.travelRule.originatorName,
          originatorAccount: payload.travelRule.originatorAccount,
          beneficiaryInstitutionId: counterparty.id,
          beneficiaryName: payload.travelRule.beneficiaryName,
          beneficiaryAccount: payload.travelRule.beneficiaryAccount,
          transferAmount: depositAmount,
          currency: "USDC",
          transactionHash: payload.fundSignature ?? payload.createSignature ?? null,
        },
      });
    }

    return NextResponse.json({ escrow: serialiseEscrow(created) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
