import type { Institution, Escrow, AmlScreening } from "@prisma/client";
import type {
  DashboardOverview,
  EscrowRecord,
  InstitutionProfile,
} from "@/lib/nexus/types";

const USDC_BASE_UNITS = 1_000_000;

export function serialiseInstitution(
  institution: Institution | null
): InstitutionProfile | null {
  if (!institution) {
    return null;
  }

  return {
    id: institution.id,
    onChainInstitutionId: institution.lei ?? institution.id,
    dynamicUserId: institution.dynamicUserId,
    wallet: institution.wallet,
    name: institution.name,
    entityType: institution.entityType,
    licenseNumber: institution.licenseNumber,
    regulatorName: institution.regulatorName,
    lei: institution.lei,
    jurisdiction: institution.jurisdiction,
    kycTier: institution.kycTier,
    kycVerifiedAt: institution.kycVerifiedAt.toISOString(),
    kycExpiresAt: institution.kycExpiresAt.toISOString(),
    isActive: institution.isActive,
    travelRuleVaspId: institution.travelRuleVaspId,
    travelRuleVaspName: institution.travelRuleVaspName,
    travelRuleProtocol: institution.travelRuleProtocol,
    contactEmail: institution.contactEmail,
    fireblocksVaultId: institution.fireblocksVaultId,
    fireblocksWebhookUrl: institution.fireblocksWebhookUrl,
    onboardingCompletedAt: institution.onboardingCompletedAt?.toISOString() ?? null,
    lastLoginAt: institution.lastLoginAt?.toISOString() ?? null,
    createdAt: institution.createdAt.toISOString(),
    updatedAt: institution.updatedAt.toISOString(),
  };
}

export function serialiseEscrow(
  escrow: Escrow & {
    importer: Institution;
    exporter: Institution;
  }
): EscrowRecord {
  return {
    id: escrow.id,
    escrowId: escrow.escrowSeed ?? escrow.id,
    onChainPda: escrow.onChainPda,
    importerInstitutionId: escrow.importerInstitutionId,
    importerInstitutionName: escrow.importer.name,
    exporterInstitutionId: escrow.exporterInstitutionId,
    exporterInstitutionName: escrow.exporter.name,
    depositAmount: escrow.depositAmount.toString(),
    tokenMint: escrow.tokenMint,
    settlementMint: escrow.settlementMint,
    status: escrow.status as EscrowRecord["status"],
    conditionsTotal: escrow.conditionsTotal,
    conditionsSatisfied: escrow.conditionsSatisfied,
    fxRate: escrow.fxRate,
    settlementAmount: escrow.settlementAmount?.toString() ?? null,
    travelRuleAttached: Boolean(escrow.travelRuleLogPda),
    travelRuleLogPda: escrow.travelRuleLogPda,
    sourceOfFundsHash: escrow.sourceOfFundsHash,
    expiresAt: escrow.expiresAt.toISOString(),
    createdAt: escrow.createdAt.toISOString(),
    settledAt: escrow.settledAt?.toISOString() ?? null,
  };
}

export function summariseOverview(params: {
  institution: Institution | null;
  escrows: Array<
    Escrow & {
      importer: Institution;
      exporter: Institution;
    }
  >;
  amlScreenings: AmlScreening[];
  kytAlertCount: number;
}): DashboardOverview {
  const { institution, escrows, amlScreenings, kytAlertCount } = params;

  const totalTvlUsd = escrows
    .filter((escrow) => escrow.status !== "Settled" && escrow.status !== "Refunded")
    .reduce(
      (sum, escrow) => sum + Number(escrow.depositAmount) / USDC_BASE_UNITS,
      0
    );

  const volume30dUsd = escrows.reduce(
    (sum, escrow) => sum + Number(escrow.depositAmount) / USDC_BASE_UNITS,
    0
  );

  const settledEscrows = escrows.filter((escrow) => escrow.settledAt);
  const averageSettlementMs =
    settledEscrows.length > 0
      ? Math.round(
          settledEscrows.reduce((sum, escrow) => {
            if (!escrow.settledAt) {
              return sum;
            }

            return (
              sum +
              (escrow.settledAt.getTime() - escrow.createdAt.getTime())
            );
          }, 0) / settledEscrows.length
        )
      : null;

  const travelRuleCoverage =
    escrows.length > 0
      ? Math.round(
          (escrows.filter((escrow) => escrow.travelRuleLogPda).length /
            escrows.length) *
            100
        )
      : 0;

  const amlClearRate =
    amlScreenings.length > 0
      ? Math.round(
          (amlScreenings.filter(
            (screening) => screening.recommendation === "CLEAR"
          ).length /
            amlScreenings.length) *
            100
        )
      : 100;

  return {
    institution: serialiseInstitution(institution),
    stats: {
      totalTvlUsd,
      activeTrades: escrows.filter(
        (escrow) => !["Settled", "Refunded", "Expired"].includes(escrow.status)
      ).length,
      volume30dUsd,
      averageSettlementMs,
      travelRuleCoverage,
      amlClearRate,
      kytAlertCount,
    },
    latestEscrows: escrows.slice(0, 6).map(serialiseEscrow),
    latestAmlScreenings: amlScreenings.slice(0, 5).map((screening) => ({
      id: screening.id,
      wallet: screening.wallet,
      riskScore: screening.riskScore,
      isSanctioned: screening.isSanctioned,
      recommendation: screening.recommendation,
      provider: screening.provider,
      screenedAt: screening.screenedAt.toISOString(),
    })),
  };
}

export function summariseEscrowRecords(params: {
  institution: InstitutionProfile | null;
  escrows: EscrowRecord[];
  amlClearRate: number;
  kytAlertCount: number;
}): DashboardOverview {
  const { institution, escrows, amlClearRate, kytAlertCount } = params;
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const totalTvlUsd = escrows
    .filter((escrow) => !["Settled", "Refunded", "Expired"].includes(escrow.status))
    .reduce(
      (sum, escrow) => sum + Number(escrow.depositAmount) / USDC_BASE_UNITS,
      0
    );

  const volume30dUsd = escrows
    .filter((escrow) => new Date(escrow.createdAt).getTime() >= thirtyDaysAgo)
    .reduce(
      (sum, escrow) => sum + Number(escrow.depositAmount) / USDC_BASE_UNITS,
      0
    );

  const settledEscrows = escrows.filter((escrow) => escrow.settledAt);
  const averageSettlementMs =
    settledEscrows.length > 0
      ? Math.round(
          settledEscrows.reduce((sum, escrow) => {
            if (!escrow.settledAt) {
              return sum;
            }

            return (
              sum +
              (new Date(escrow.settledAt).getTime() -
                new Date(escrow.createdAt).getTime())
            );
          }, 0) / settledEscrows.length
        )
      : null;

  const travelRuleCoverage =
    escrows.length > 0
      ? Math.round(
          (escrows.filter((escrow) => escrow.travelRuleAttached).length /
            escrows.length) *
            100
        )
      : 0;

  return {
    institution,
    stats: {
      totalTvlUsd,
      activeTrades: escrows.filter(
        (escrow) => !["Settled", "Refunded", "Expired"].includes(escrow.status)
      ).length,
      volume30dUsd,
      averageSettlementMs,
      travelRuleCoverage,
      amlClearRate,
      kytAlertCount,
    },
    latestEscrows: escrows.slice(0, 6),
    latestAmlScreenings: [],
  };
}
