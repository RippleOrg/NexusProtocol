import type {
  ENTITY_TYPES,
  JURISDICTIONS,
  TRAVEL_RULE_PROTOCOLS,
} from "@/lib/nexus/constants";

export type EntityType = (typeof ENTITY_TYPES)[number];
export type TravelRuleProtocol = (typeof TRAVEL_RULE_PROTOCOLS)[number];
export type JurisdictionCode = (typeof JURISDICTIONS)[number]["code"];

export type EscrowStatus =
  | "Created"
  | "Funded"
  | "ConditionsPartial"
  | "ConditionsSatisfied"
  | "InDispute"
  | "Settled"
  | "Refunded"
  | "Expired";

export type TradeConditionType =
  | "DocumentHash"
  | "OracleConfirm"
  | "TimeBased"
  | "ManualApproval"
  | "MultiSigApproval";

export interface InstitutionProfile {
  id: string;
  onChainInstitutionId: string;
  dynamicUserId?: string | null;
  wallet: string;
  name: string;
  entityType?: string | null;
  licenseNumber?: string | null;
  regulatorName?: string | null;
  lei?: string | null;
  jurisdiction: string;
  kycTier: number;
  kycVerifiedAt: string;
  kycExpiresAt: string;
  isActive: boolean;
  travelRuleVaspId?: string | null;
  travelRuleVaspName?: string | null;
  travelRuleProtocol?: string | null;
  contactEmail?: string | null;
  fireblocksVaultId?: string | null;
  fireblocksWebhookUrl?: string | null;
  onboardingCompletedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionDirectoryItem {
  id: string;
  onChainInstitutionId: string;
  name: string;
  wallet: string;
  jurisdiction: string;
  kycTier: number;
  travelRuleVaspId?: string | null;
}

export interface TradeConditionInput {
  conditionType: TradeConditionType;
  description: string;
  documentHash?: string;
  releaseBps: number;
}

export interface TravelRuleInput {
  originatorName: string;
  originatorAccount: string;
  beneficiaryName: string;
  beneficiaryAccount: string;
  transactionReference: string;
}

export interface CreateEscrowInput {
  counterpartyInstitutionId: string;
  depositAmountUsdc: number;
  settlementInstrument: string;
  fxPair: string;
  fxRateReference: number;
  fxRateBandBps: number;
  expiresAt: string;
  sourceOfFundsHash: string;
  conditions: TradeConditionInput[];
  travelRule: TravelRuleInput;
}

export interface EscrowRecord {
  id: string;
  escrowId: string;
  onChainPda: string;
  importerInstitutionId: string;
  importerInstitutionName: string;
  exporterInstitutionId: string;
  exporterInstitutionName: string;
  depositAmount: string;
  tokenMint: string;
  settlementMint: string;
  status: EscrowStatus;
  conditionsTotal: number;
  conditionsSatisfied: number;
  fxRate?: number | null;
  settlementAmount?: string | null;
  travelRuleAttached: boolean;
  travelRuleLogPda?: string | null;
  sourceOfFundsHash?: string | null;
  expiresAt: string;
  createdAt: string;
  settledAt?: string | null;
}

export interface DashboardOverview {
  institution: InstitutionProfile | null;
  stats: {
    totalTvlUsd: number;
    activeTrades: number;
    volume30dUsd: number;
    averageSettlementMs: number | null;
    travelRuleCoverage: number;
    amlClearRate: number;
    kytAlertCount: number;
  };
  latestEscrows: EscrowRecord[];
  latestAmlScreenings: Array<{
    id: string;
    wallet: string;
    riskScore: number;
    isSanctioned: boolean;
    recommendation: string;
    provider: string;
    screenedAt: string;
  }>;
}
