export interface DemoCondition {
  type: "DocumentHash" | "OracleConfirm" | "TimeBased" | "ManualApproval" | "MultiSigApproval";
  description: string;
  releasePercent: number;
}

export interface TravelRuleData {
  originatorName: string;
  originatorAccount: string;
  beneficiaryName: string;
  beneficiaryAccount: string;
}

export interface DemoTrade {
  amount: number;
  depositCurrency: string;
  settlementCurrency: string;
  description: string;
  conditions: DemoCondition[];
  disputeWindowHours: number;
  travelRuleData?: TravelRuleData;
}

export interface DemoInstitution {
  id: string;
  name: string;
  jurisdiction: string;
  kycTier: 1 | 2 | 3;
  wallet?: string;
  fireblocksEnabled?: boolean;
  role: "importer" | "exporter";
  flagshipLogo?: boolean;
}

export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  institutions: DemoInstitution[];
  trades: DemoTrade[];
  autoPlay: boolean;
  /** Total demo playback duration in milliseconds (not the on-chain settlement latency). */
  settlementDelayMs: number;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "amina-zurich-lagos",
    name: "AMINA Bank — Zurich to Lagos",
    description:
      "Swiss cocoa importer (AMINA Bank client) purchasing from Nigerian exporter",
    institutions: [
      {
        id: "AMINA-CH-001",
        name: "AMINA Bank (Zurich)",
        jurisdiction: "CH",
        kycTier: 3,
        wallet: "DEMO_WALLET_AMINA",
        fireblocksEnabled: true,
        role: "importer",
        flagshipLogo: true,
      },
      {
        id: "NEXUS-NG-001",
        name: "First Bank Nigeria PLC",
        jurisdiction: "NG",
        kycTier: 2,
        wallet: "DEMO_WALLET_FBN",
        role: "exporter",
      },
    ],
    trades: [
      {
        amount: 500000,
        depositCurrency: "USDC",
        settlementCurrency: "NGN",
        description: "Cocoa commodity purchase — Q1 2026",
        conditions: [
          {
            type: "DocumentHash",
            description: "Bill of Lading",
            releasePercent: 30,
          },
          {
            type: "OracleConfirm",
            description: "Customs clearance (Lagos Port)",
            releasePercent: 40,
          },
          {
            type: "ManualApproval",
            description: "Quality inspection certificate",
            releasePercent: 30,
          },
        ],
        disputeWindowHours: 72,
        travelRuleData: {
          originatorName: "AMINA Bank AG",
          originatorAccount: "CH56-0483-5012-3456-7800-9",
          beneficiaryName: "First Bank Nigeria PLC",
          beneficiaryAccount: "NG12FBNI012345678901234",
        },
      },
    ],
    autoPlay: true,
    settlementDelayMs: 17400,
  },
  {
    id: "ubs-zurich-nairobi",
    name: "UBS Trade Finance — Zurich to Nairobi",
    description:
      "Swiss coffee importer acquiring Kenyan coffee export via UBS trade finance desk",
    institutions: [
      {
        id: "UBS-TF-001",
        name: "UBS Trade Finance AG",
        jurisdiction: "CH",
        kycTier: 3,
        role: "importer",
      },
      {
        id: "NEXUS-KE-001",
        name: "Equity Bank Kenya",
        jurisdiction: "KE",
        kycTier: 2,
        role: "exporter",
      },
    ],
    trades: [
      {
        amount: 1200000,
        depositCurrency: "USDC",
        settlementCurrency: "KES",
        description: "Arabica coffee export — Batch KE-2026-Q1",
        conditions: [
          {
            type: "DocumentHash",
            description: "Phytosanitary Certificate",
            releasePercent: 25,
          },
          {
            type: "DocumentHash",
            description: "Bill of Lading",
            releasePercent: 25,
          },
          {
            type: "OracleConfirm",
            description: "Port of Mombasa departure",
            releasePercent: 25,
          },
          {
            type: "ManualApproval",
            description: "UBS credit confirmation",
            releasePercent: 25,
          },
        ],
        disputeWindowHours: 48,
      },
    ],
    autoPlay: true,
    settlementDelayMs: 17400,
  },
];
