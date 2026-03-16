export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface KytTransaction {
  txHash: string;
  wallet: string;
  amount: number;
  currency: string;
  direction: "INCOMING" | "OUTGOING";
  counterpartyWallet?: string;
  timestamp: number;
}

export interface KytFlag {
  type: string;
  description: string;
  severity: RiskLevel;
}

export interface KytResult {
  riskLevel: RiskLevel;
  flags: KytFlag[];
  recommendation: "PROCEED" | "REVIEW" | "BLOCK";
  score: number;
}

// Risk thresholds
const VELOCITY_LIMIT_USD = 100_000; // per window
const STRUCTURING_THRESHOLD = 9_500; // just below $10k reporting threshold
// Round-number avoidance detection: flag amounts within $100 of a $1k boundary
const ROUND_BUCKET = 1_000;
const ROUND_LOWER_BOUND = 100; // below a multiple of ROUND_BUCKET
const ROUND_UPPER_BOUND = 900; // above a multiple of ROUND_BUCKET
const CORRIDOR_RISK_MAP: Record<string, RiskLevel> = {
  "NG-NG": "LOW",
  "US-NG": "MEDIUM",
  "US-KE": "MEDIUM",
  "US-GH": "MEDIUM",
  "US-US": "LOW",
  "EU-EU": "LOW",
  "NG-KE": "MEDIUM",
  "RU-*": "HIGH",
  "*-KP": "CRITICAL",
  "*-IR": "CRITICAL",
  "*-SY": "CRITICAL",
  "*-CU": "HIGH",
};

export class KytEngine {
  async evaluateTransaction(tx: KytTransaction): Promise<KytResult> {
    const flags: KytFlag[] = [];
    let score = 0;

    // Check for suspicious amount patterns (just below round numbers)
    if (tx.amount % ROUND_BUCKET > ROUND_UPPER_BOUND || tx.amount % ROUND_BUCKET < ROUND_LOWER_BOUND) {
      flags.push({
        type: "ROUND_NUMBER_AVOIDANCE",
        description: "Amount suspiciously close to round number",
        severity: "LOW",
      });
      score += 1;
    }

    // Check for very large single transactions
    if (tx.amount > 1_000_000) {
      flags.push({
        type: "LARGE_TRANSACTION",
        description: "Transaction exceeds $1M threshold",
        severity: "HIGH",
      });
      score += 3;
    } else if (tx.amount > 100_000) {
      flags.push({
        type: "HIGH_VALUE_TRANSACTION",
        description: "Transaction exceeds $100K threshold",
        severity: "MEDIUM",
      });
      score += 1;
    }

    const riskLevel: RiskLevel =
      score >= 7 ? "CRITICAL" : score >= 4 ? "HIGH" : score >= 2 ? "MEDIUM" : "LOW";

    const recommendation: KytResult["recommendation"] =
      riskLevel === "CRITICAL" || riskLevel === "HIGH"
        ? "BLOCK"
        : riskLevel === "MEDIUM"
        ? "REVIEW"
        : "PROCEED";

    return { riskLevel, flags, recommendation, score };
  }

  async checkVelocity(
    wallet: string,
    amount: number,
    windowHours: number
  ): Promise<boolean> {
    // In production, query the database for recent transaction volume
    // Returns true if velocity limit exceeded
    // For now we check against a simple threshold
    return amount > VELOCITY_LIMIT_USD;
  }

  detectStructuring(
    wallet: string,
    recentTxs: KytTransaction[]
  ): boolean {
    // Detect structuring: multiple transactions just below reporting threshold
    const suspiciousCount = recentTxs.filter(
      (tx) => tx.amount >= STRUCTURING_THRESHOLD && tx.amount < 10_000
    ).length;
    return suspiciousCount >= 3;
  }

  assessCorridorRisk(
    fromJurisdiction: string,
    toJurisdiction: string
  ): RiskLevel {
    const key = `${fromJurisdiction}-${toJurisdiction}`;
    if (CORRIDOR_RISK_MAP[key]) return CORRIDOR_RISK_MAP[key];

    // Check wildcard destination rules
    const toWildcard = `*-${toJurisdiction}`;
    if (CORRIDOR_RISK_MAP[toWildcard]) return CORRIDOR_RISK_MAP[toWildcard];

    // Check wildcard source rules
    const fromWildcard = `${fromJurisdiction}-*`;
    if (CORRIDOR_RISK_MAP[fromWildcard]) return CORRIDOR_RISK_MAP[fromWildcard];

    return "LOW";
  }
}

export const kytEngine = new KytEngine();
