import crypto from "crypto";
import type { PrismaClient as PrismaClientType } from "@prisma/client";
import { getFallbackRateByPair } from "@/lib/integrations/free-market-data";
import { getStreamClient } from "@/lib/integrations/six-bfi-stream";
import { sixBfiClient } from "@/lib/integrations/six-bfi";
import { deriveProtocolConfigPda } from "@/lib/nexus/onchain";
import { withSolanaReadFallback } from "@/lib/server/solana-rpc";

// ─── Constants ────────────────────────────────────────────────────────────────

/** USDC has 6 decimal places; on-chain amounts are in micro-USDC. */
const USDC_DECIMALS = 1_000_000;

/** Default NEXUS protocol fee in basis points (fallback when config unavailable). */
const DEFAULT_NEXUS_FEE_BPS = 30;

/** SWIFT equivalent cost fraction (3 % of transaction value). */
const SWIFT_COST_FRACTION = 0.03;

/** Milliseconds per day. */
const MS_PER_DAY = 24 * 60 * 60 * 1_000;

/** Nexus program ID (matches NEXT_PUBLIC_NEXUS_PROGRAM_ID env var). */
const NEXUS_PROGRAM_ID =
  process.env.NEXT_PUBLIC_NEXUS_PROGRAM_ID ??
  "3GapkzNSKXUgtjLXh4wSuWQBA13EwQSzTRNiDwcpFBp7";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface CorridorMetrics {
  fromJurisdiction: string;
  toJurisdiction: string;
  fromFlag: string;
  toFlag: string;
  currencyPair: string;
  sixBfiValorBc: string;
  liveRate: number;
  rateChange24h: number;
  volume24h: number;
  volume30d: number;
  tradeCount30d: number;
  avgSettlementMs: number;
  swiftEquivalentCost: number;
  nexusCost: number;
  savingsUsd: number;
  savingsPct: number;
  compliance: {
    travelRuleRate: number;
    avgAmlScore: number;
    flaggedCount: number;
  };
}

interface CorridorDef {
  from: string;
  to: string;
  pair: string;
  valorBc: string;
}

interface ParsedEscrow {
  importerInstitutionId: string;
  exporterInstitutionId: string;
  depositAmountUsdc: number;
  status: number;
  createdAtMs: number;
  fundedAtMs: number | null;
  settledAtMs: number | null;
  travelRuleAttached: boolean;
}

// ─── NEXUS Priority Corridors ─────────────────────────────────────────────────

// Real SIX VALOR_BC identifiers (BC = 148)
export const NEXUS_CORRIDORS: CorridorDef[] = [
  { from: "CH", to: "NG", pair: "USD/NGN", valorBc: "199113_148" },
  { from: "DE", to: "NG", pair: "USD/NGN", valorBc: "199113_148" },
  { from: "GB", to: "NG", pair: "GBP/NGN", valorBc: "282981_148" },
  { from: "CH", to: "KE", pair: "USD/KES", valorBc: "275141_148" },
  { from: "GB", to: "KE", pair: "GBP/KES", valorBc: "199615_148" },
  { from: "CH", to: "GH", pair: "USD/GHS", valorBc: "3206444_148" },
  { from: "DE", to: "GH", pair: "EUR/USD", valorBc: "946681_148" },
];

// Emoji flag lookup for supported jurisdictions
const JURISDICTION_FLAGS: Record<string, string> = {
  CH: "🇨🇭",
  DE: "🇩🇪",
  GB: "🇬🇧",
  NG: "🇳🇬",
  KE: "🇰🇪",
  GH: "🇬🇭",
  US: "🇺🇸",
  FR: "🇫🇷",
  EU: "🇪🇺",
};

// ─── EscrowStatus enum (mirrors programs/nexus/src/state/escrow.rs) ──────────

const ESCROW_STATUS_SETTLED = 5;

// ─── Borsh reader ─────────────────────────────────────────────────────────────

/**
 * Minimal cursor-based Borsh reader sufficient to extract the fields we need
 * from a serialized EscrowAccount.  Borsh encodes Strings as (u32 length LE)
 * followed by UTF-8 bytes, Options as a u8 discriminant (0=None, 1=Some)
 * followed by the value when Some, and Vecs as (u32 count LE) followed by
 * their elements.
 */
class BorshReader {
  private readonly data: Buffer;
  private offset: number;

  constructor(data: Buffer, startOffset = 0) {
    this.data = data;
    this.offset = startOffset;
  }

  skip(n: number): void {
    this.offset += n;
  }

  readU8(): number {
    if (this.offset >= this.data.length)
      throw new RangeError("BorshReader: buffer underflow");
    const v = this.data.readUInt8(this.offset);
    this.offset += 1;
    return v;
  }

  readU32(): number {
    if (this.offset + 4 > this.data.length)
      throw new RangeError("BorshReader: buffer underflow");
    const v = this.data.readUInt32LE(this.offset);
    this.offset += 4;
    return v;
  }

  readU64(): bigint {
    if (this.offset + 8 > this.data.length)
      throw new RangeError("BorshReader: buffer underflow");
    const v = this.data.readBigUInt64LE(this.offset);
    this.offset += 8;
    return v;
  }

  readI64(): bigint {
    if (this.offset + 8 > this.data.length)
      throw new RangeError("BorshReader: buffer underflow");
    const v = this.data.readBigInt64LE(this.offset);
    this.offset += 8;
    return v;
  }

  readString(): string {
    const len = this.readU32();
    if (this.offset + len > this.data.length)
      throw new RangeError("BorshReader: string buffer underflow");
    const str = this.data.toString("utf8", this.offset, this.offset + len);
    this.offset += len;
    return str;
  }

  readBool(): boolean {
    return this.readU8() !== 0;
  }

  readOptionI64(): bigint | null {
    const some = this.readU8();
    if (!some) return null;
    return this.readI64();
  }
}

/**
 * Skip one serialised TradeCondition so the reader advances past the Vec
 * element without needing to store its fields.
 *
 * Layout (mirrors TradeCondition::SPACE in escrow.rs):
 *   condition_type: u8
 *   description: String (4 + len)
 *   document_hash: Option<[u8;32]> (1 + optional 32)
 *   oracle_feed: Option<Pubkey> (1 + optional 32)
 *   oracle_expected_value: Option<i64> (1 + optional 8)
 *   deadline: Option<i64> (1 + optional 8)
 *   is_satisfied: bool (1)
 *   satisfied_at: Option<i64> (1 + optional 8)
 *   satisfied_by: Option<Pubkey> (1 + optional 32)
 *   release_bps: u16 (2)
 */
function skipTradeCondition(r: BorshReader): void {
  r.readU8(); // condition_type
  r.readString(); // description
  if (r.readU8()) r.skip(32); // document_hash
  if (r.readU8()) r.skip(32); // oracle_feed
  if (r.readU8()) r.skip(8); // oracle_expected_value
  if (r.readU8()) r.skip(8); // deadline
  r.readU8(); // is_satisfied
  if (r.readU8()) r.skip(8); // satisfied_at
  if (r.readU8()) r.skip(32); // satisfied_by
  r.skip(2); // release_bps
}

/**
 * Parse the fields we need from a raw serialised EscrowAccount buffer.
 * Returns null if the buffer is too short or malformed.
 *
 * Full field order (mirrors EscrowAccount in escrow.rs):
 *   [8]  discriminator
 *   escrow_id: String
 *   importer: Pubkey (32)
 *   exporter: Pubkey (32)
 *   importer_institution_id: String
 *   exporter_institution_id: String
 *   token_mint: Pubkey (32)
 *   vault_token_account: Pubkey (32)
 *   deposit_amount: u64
 *   released_amount: u64
 *   settlement_currency_mint: Pubkey (32)
 *   fx_rate_band_bps: u16
 *   conditions: Vec<TradeCondition>
 *   conditions_satisfied: u8
 *   status: u8
 *   dispute_window_hours: u8
 *   dispute_raised_at: Option<i64>
 *   created_at: i64
 *   funded_at: Option<i64>
 *   settled_at: Option<i64>
 *   expires_at: i64
 *   travel_rule_attached: bool
 *   … (source_of_funds_hash, collateral, bump — not needed)
 */
function parseEscrowAccount(data: Buffer): ParsedEscrow | null {
  try {
    const r = new BorshReader(data, 8); // skip 8-byte Anchor discriminator

    r.readString(); // escrow_id
    r.skip(32); // importer pubkey
    r.skip(32); // exporter pubkey
    const importerInstitutionId = r.readString();
    const exporterInstitutionId = r.readString();
    r.skip(32); // token_mint
    r.skip(32); // vault_token_account
    const depositAmountRaw = r.readU64();
    r.readU64(); // released_amount (unused)
    r.skip(32); // settlement_currency_mint
    r.skip(2); // fx_rate_band_bps

    // Vec<TradeCondition>
    const conditionCount = r.readU32();
    for (let i = 0; i < conditionCount; i++) {
      skipTradeCondition(r);
    }

    r.readU8(); // conditions_satisfied bitmask
    const status = r.readU8();
    r.readU8(); // dispute_window_hours

    // dispute_raised_at Option<i64>
    if (r.readU8()) r.skip(8);

    const createdAtSec = r.readI64();

    // funded_at Option<i64>
    const hasFundedAt = r.readU8();
    const fundedAtSec = hasFundedAt ? r.readI64() : null;

    // settled_at Option<i64>
    const hasSettledAt = r.readU8();
    const settledAtSec = hasSettledAt ? r.readI64() : null;

    r.skip(8); // expires_at

    const travelRuleAttached = r.readBool();

    return {
      importerInstitutionId,
      exporterInstitutionId,
      depositAmountUsdc: Number(depositAmountRaw) / USDC_DECIMALS,
      status,
      createdAtMs: Number(createdAtSec) * 1_000,
      fundedAtMs: fundedAtSec !== null ? Number(fundedAtSec) * 1_000 : null,
      settledAtMs: settledAtSec !== null ? Number(settledAtSec) * 1_000 : null,
      travelRuleAttached,
    };
  } catch {
    return null;
  }
}

// ─── ProtocolConfig parsing ───────────────────────────────────────────────────

/**
 * Parse fee_bps from the ProtocolConfig account.
 * Layout (after 8-byte discriminator):
 *   admin: Pubkey (32)
 *   fee_bps: u16 (2)
 */
function parseProtocolConfigFeeBps(data: Buffer): number | null {
  try {
    if (data.length < 8 + 32 + 2) return null;
    return data.readUInt16LE(8 + 32);
  } catch {
    return null;
  }
}

// ─── On-chain data helpers ────────────────────────────────────────────────────

/** Compute the 8-byte Anchor account discriminator for an account named `name`. */
function anchorDiscriminator(name: string): Buffer {
  return Buffer.from(
    crypto.createHash("sha256").update(`account:${name}`).digest()
  ).subarray(0, 8);
}

// ─── Compliance metrics from Prisma ──────────────────────────────────────────

interface ComplianceMetrics {
  travelRuleRate: number;
  avgAmlScore: number;
  flaggedCount: number;
}

// ─── Main analytics engine ────────────────────────────────────────────────────

export class CorridorAnalyticsEngine {
  /**
   * Fetch live FX rate for a corridor from the SIX BFI WebSocket stream.
   * Falls back to the REST client when the stream has no cached data.
   */
  private async getLiveRate(
    valorBc: string,
    pair: string
  ): Promise<{ rate: number; change24h: number }> {
    // Try the streaming client first (zero-latency cached data)
    try {
      const streamClient = getStreamClient();
      const streamRate = streamClient.getLatestRate(valorBc);
      if (streamRate && !streamRate.isStale) {
        return { rate: streamRate.lastPrice, change24h: streamRate.change24h };
      }
    } catch {
      // stream client unavailable — fall through to REST
    }

    // REST fallback
    try {
      const [base, quote] = pair.split("/");
      if (base && quote) {
        const fxRate = await sixBfiClient.getFxRate(base, quote);
        return { rate: fxRate.rate, change24h: fxRate.change24h };
      }
    } catch {
      // REST also unavailable
    }

    try {
      const fallbackRate = await getFallbackRateByPair({ valorBc, pair });
      return { rate: fallbackRate.rate, change24h: fallbackRate.change24h };
    } catch {
      // fallback source unavailable
    }

    return { rate: 0, change24h: 0 };
  }

  /**
   * Fetch all on-chain EscrowAccount records via getProgramAccounts filtered
   * by the Anchor discriminator.  Returns null when the RPC is unavailable.
   */
  private async fetchOnChainEscrows(): Promise<ParsedEscrow[] | null> {
    try {
      const { PublicKey } = await import("@solana/web3.js");
      const bs58 = (await import("bs58")).default;

      const programId = new PublicKey(NEXUS_PROGRAM_ID);
      const discriminator = anchorDiscriminator("EscrowAccount");
      const { value: accounts } = await withSolanaReadFallback((connection) =>
        connection.getProgramAccounts(programId, {
          filters: [
            {
              memcmp: {
                offset: 0,
                bytes: bs58.encode(discriminator),
              },
            },
          ],
        })
      );

      const parsed: ParsedEscrow[] = [];
      for (const acc of accounts) {
        const escrow = parseEscrowAccount(acc.account.data as Buffer);
        if (escrow) parsed.push(escrow);
      }
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Fetch the NEXUS protocol fee (fee_bps) from the on-chain ProtocolConfig
   * account.  Returns the default value when unavailable.
   */
  private async fetchProtocolFeeBps(): Promise<number> {
    try {
      const { PublicKey } = await import("@solana/web3.js");
      const configPda = new PublicKey(deriveProtocolConfigPda());
      const { value: accountInfo } = await withSolanaReadFallback((connection) =>
        connection.getAccountInfo(configPda)
      );
      if (!accountInfo) return DEFAULT_NEXUS_FEE_BPS;

      const feeBps = parseProtocolConfigFeeBps(accountInfo.data as Buffer);
      return feeBps ?? DEFAULT_NEXUS_FEE_BPS;
    } catch {
      return DEFAULT_NEXUS_FEE_BPS;
    }
  }

  /**
   * Fetch escrows from PostgreSQL when on-chain data is unavailable.
   *
   * The KYC verify route stores `Institution.name = institutionId` (the same
   * institution_id string used on-chain), so we can join on `name`.
   */
  private async fetchDbEscrows(
    prisma: PrismaClientType
  ): Promise<ParsedEscrow[]> {
    const since30d = new Date(Date.now() - 30 * MS_PER_DAY);
    const escrows = await prisma.escrow.findMany({
      where: { createdAt: { gte: since30d } },
      select: {
        depositAmount: true,
        status: true,
        createdAt: true,
        settledAt: true,
        travelRuleLogPda: true,
        importer: { select: { name: true } },
        exporter: { select: { name: true } },
      },
      // Generous limit for high-volume corridors; callers fetch for 30-day window only
      take: 10_000,
    });

    return escrows.map((e) => ({
      importerInstitutionId: e.importer.name,
      exporterInstitutionId: e.exporter.name,
      depositAmountUsdc: Number(e.depositAmount) / USDC_DECIMALS,
      status: escrowStatusStringToInt(e.status),
      createdAtMs: e.createdAt.getTime(),
      fundedAtMs: null, // not stored separately in the Prisma model
      settledAtMs: e.settledAt ? e.settledAt.getTime() : null,
      travelRuleAttached: !!e.travelRuleLogPda,
    }));
  }

  /**
   * Build a map from institution name (= on-chain institution_id) to
   * jurisdiction code, sourced from PostgreSQL.
   */
  private async buildInstitutionJurisdictionMap(
    prisma: PrismaClientType
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const institutions = await prisma.institution.findMany({
      select: { name: true, jurisdiction: true },
    });
    for (const inst of institutions) {
      map.set(inst.name, inst.jurisdiction);
    }
    return map;
  }

  /**
   * Compute AML compliance metrics for the given set of escrows using a
   * shared Prisma client.
   */
  private async fetchComplianceMetrics(
    escrows: ParsedEscrow[],
    prisma: PrismaClientType
  ): Promise<ComplianceMetrics> {
    const total = escrows.length;
    if (total === 0) {
      return { travelRuleRate: 0, avgAmlScore: 0, flaggedCount: 0 };
    }

    // Travel Rule rate derived directly from on-chain / DB escrow flags
    const travelRuleCount = escrows.filter((e) => e.travelRuleAttached).length;
    const travelRuleRate = (travelRuleCount / total) * 100;

    // AML metrics — aggregate over all institutions involved in this corridor
    let avgAmlScore = 0;
    let flaggedCount = 0;

    const institutionNames = [
      ...new Set([
        ...escrows.map((e) => e.importerInstitutionId),
        ...escrows.map((e) => e.exporterInstitutionId),
      ]),
    ];

    try {
      const institutions = await prisma.institution.findMany({
        where: { name: { in: institutionNames } },
        select: { id: true },
      });
      const institutionIds = institutions.map((i) => i.id);

      if (institutionIds.length > 0) {
        // Aggregate directly in the DB to avoid loading large result sets
        const [scoreAgg, blockedCount] = await Promise.all([
          prisma.amlScreening.aggregate({
            where: { institutionId: { in: institutionIds } },
            _avg: { riskScore: true },
          }),
          prisma.amlScreening.count({
            where: {
              institutionId: { in: institutionIds },
              recommendation: "BLOCK",
            },
          }),
        ]);

        avgAmlScore = scoreAgg._avg.riskScore ?? 0;
        flaggedCount = blockedCount;
      }
    } catch {
      // DB unavailable — return zero AML metrics
    }

    return { travelRuleRate, avgAmlScore, flaggedCount };
  }

  /**
   * Create a Prisma client, run `fn`, and guarantee disconnection.
   * Returns null when the DB is unavailable.
   */
  private async withPrisma<T>(
    fn: (prisma: PrismaClientType) => Promise<T>
  ): Promise<T | null> {
    let prisma: PrismaClientType | null = null;
    try {
      const { PrismaClient } = await import("@prisma/client");
      prisma = new PrismaClient() as PrismaClientType;
      return await fn(prisma);
    } catch {
      return null;
    } finally {
      await prisma?.$disconnect();
    }
  }

  /**
   * Compute CorridorMetrics for a single corridor.
   *
   * @param from  ISO 3166-1 alpha-2 code of the sending jurisdiction (e.g. "CH")
   * @param to    ISO 3166-1 alpha-2 code of the receiving jurisdiction (e.g. "NG")
   */
  async getCorridorMetrics(from: string, to: string): Promise<CorridorMetrics> {
    const corridorDef = NEXUS_CORRIDORS.find(
      (c) => c.from === from && c.to === to
    );
    if (!corridorDef) {
      throw new Error(`Unknown corridor: ${from} → ${to}`);
    }

    // Fetch on-chain data and the live rate in parallel; open a single DB
    // connection for all PostgreSQL work in this request cycle.
    const [onChainEscrows, feeBps, rateData, dbResult] = await Promise.all([
      this.fetchOnChainEscrows(),
      this.fetchProtocolFeeBps(),
      this.getLiveRate(corridorDef.valorBc, corridorDef.pair),
      this.withPrisma(async (prisma) => {
        const [jurisdictionMap, dbEscrowsFallback] = await Promise.all([
          this.buildInstitutionJurisdictionMap(prisma),
          // Pre-fetch DB escrows in case on-chain fetch failed
          this.fetchDbEscrows(prisma),
        ]);
        return { jurisdictionMap, dbEscrowsFallback };
      }),
    ]);

    const jurisdictionMap =
      dbResult?.jurisdictionMap ?? new Map<string, string>();
    const allEscrows =
      onChainEscrows !== null
        ? onChainEscrows
        : (dbResult?.dbEscrowsFallback ?? []);

    const corridorEscrows = filterEscrowsByJurisdiction(
      allEscrows,
      from,
      to,
      jurisdictionMap
    );

    const compliance =
      (await this.withPrisma((prisma) =>
        this.fetchComplianceMetrics(corridorEscrows, prisma)
      )) ?? { travelRuleRate: 0, avgAmlScore: 0, flaggedCount: 0 };

    return buildMetrics(corridorDef, corridorEscrows, rateData, feeBps, compliance);
  }

  /**
   * Compute CorridorMetrics for every NEXUS priority corridor in one batch.
   * On-chain data and DB queries share a single connection for efficiency.
   */
  async getAllCorridorMetrics(): Promise<CorridorMetrics[]> {
    // Fetch on-chain data and the protocol fee in parallel with DB work
    const [onChainEscrows, feeBps, dbResult] = await Promise.all([
      this.fetchOnChainEscrows(),
      this.fetchProtocolFeeBps(),
      this.withPrisma(async (prisma) => {
        const [jurisdictionMap, dbEscrowsFallback] = await Promise.all([
          this.buildInstitutionJurisdictionMap(prisma),
          this.fetchDbEscrows(prisma),
        ]);
        return { jurisdictionMap, dbEscrowsFallback, prisma };
      }),
    ]);

    const jurisdictionMap =
      dbResult?.jurisdictionMap ?? new Map<string, string>();
    const allEscrows =
      onChainEscrows !== null
        ? onChainEscrows
        : (dbResult?.dbEscrowsFallback ?? []);

    // Fetch live rates for every unique valorBc in parallel
    const uniqueValorBcs = [
      ...new Set(NEXUS_CORRIDORS.map((c) => c.valorBc)),
    ];
    const rateResults = await Promise.all(
      uniqueValorBcs.map((vbc) => {
        const pair =
          NEXUS_CORRIDORS.find((c) => c.valorBc === vbc)?.pair ?? "";
        return this.getLiveRate(vbc, pair).then((r) => [vbc, r] as const);
      })
    );
    const rateMap = new Map(rateResults);

    // Compute per-corridor escrow groups and compliance metrics.
    // A single Prisma connection (already open from `dbResult`) is reused
    // across all corridors; if DB was unavailable we fall back to zero metrics.
    return Promise.all(
      NEXUS_CORRIDORS.map(async (corridorDef) => {
        const corridorEscrows = filterEscrowsByJurisdiction(
          allEscrows,
          corridorDef.from,
          corridorDef.to,
          jurisdictionMap
        );
        const rateData = rateMap.get(corridorDef.valorBc) ?? {
          rate: 0,
          change24h: 0,
        };

        let compliance: ComplianceMetrics = {
          travelRuleRate: 0,
          avgAmlScore: 0,
          flaggedCount: 0,
        };
        if (dbResult?.prisma) {
          try {
            compliance = await this.fetchComplianceMetrics(
              corridorEscrows,
              dbResult.prisma
            );
          } catch {
            // fall through to zero metrics
          }
        }

        return buildMetrics(
          corridorDef,
          corridorEscrows,
          rateData,
          feeBps,
          compliance
        );
      })
    );
  }
}

// ─── Pure helpers (no I/O) ───────────────────────────────────────────────────

/** Map Prisma EscrowStatus string to the on-chain integer representation. */
function escrowStatusStringToInt(status: string): number {
  const map: Record<string, number> = {
    Created: 0,
    Funded: 1,
    ConditionsPartial: 2,
    ConditionsSatisfied: 3,
    InDispute: 4,
    Settled: 5,
    Refunded: 6,
    Expired: 7,
  };
  return map[status] ?? 0;
}

/**
 * Filter a flat list of escrows to those belonging to a specific (from, to)
 * corridor by looking up each institution ID in the jurisdiction map.
 */
function filterEscrowsByJurisdiction(
  escrows: ParsedEscrow[],
  from: string,
  to: string,
  jurisdictionMap: Map<string, string>
): ParsedEscrow[] {
  return escrows.filter((e) => {
    const importerJurisdiction = jurisdictionMap.get(e.importerInstitutionId);
    const exporterJurisdiction = jurisdictionMap.get(e.exporterInstitutionId);
    return importerJurisdiction === from && exporterJurisdiction === to;
  });
}

/**
 * Compute CorridorMetrics from a filtered set of escrows + pre-fetched inputs.
 */
function buildMetrics(
  corridorDef: CorridorDef,
  escrows: ParsedEscrow[],
  rateData: { rate: number; change24h: number },
  feeBps: number,
  compliance: ComplianceMetrics
): CorridorMetrics {
  const now = Date.now();
  const cutoff24h = now - MS_PER_DAY;
  const cutoff30d = now - 30 * MS_PER_DAY;

  // Volume windows
  const escrows30d = escrows.filter((e) => e.createdAtMs >= cutoff30d);
  const escrows24h = escrows.filter((e) => e.createdAtMs >= cutoff24h);

  const volume30d = escrows30d.reduce((s, e) => s + e.depositAmountUsdc, 0);
  const volume24h = escrows24h.reduce((s, e) => s + e.depositAmountUsdc, 0);
  const tradeCount30d = escrows30d.length;

  // Average settlement time (funded → settled) in milliseconds.
  // Filter to escrows where both timestamps are available.
  const settledWithTimes = escrows30d.filter(
    (e): e is ParsedEscrow & { settledAtMs: number; fundedAtMs: number } =>
      e.status === ESCROW_STATUS_SETTLED &&
      e.settledAtMs !== null &&
      e.fundedAtMs !== null
  );
  const avgSettlementMs =
    settledWithTimes.length > 0
      ? settledWithTimes.reduce(
          (sum, e) => sum + (e.settledAtMs - e.fundedAtMs),
          0
        ) / settledWithTimes.length
      : 0;

  // Cost comparison (based on 24-hour volume)
  const swiftEquivalentCost = volume24h * SWIFT_COST_FRACTION;
  const nexusCost = volume24h * (feeBps / 10_000);
  const savingsUsd = swiftEquivalentCost - nexusCost;
  const savingsPct =
    swiftEquivalentCost > 0 ? (savingsUsd / swiftEquivalentCost) * 100 : 0;

  return {
    fromJurisdiction: corridorDef.from,
    toJurisdiction: corridorDef.to,
    fromFlag: JURISDICTION_FLAGS[corridorDef.from] ?? "🏳",
    toFlag: JURISDICTION_FLAGS[corridorDef.to] ?? "🏳",
    currencyPair: corridorDef.pair,
    sixBfiValorBc: corridorDef.valorBc,
    liveRate: rateData.rate,
    rateChange24h: rateData.change24h,
    volume24h,
    volume30d,
    tradeCount30d,
    avgSettlementMs,
    swiftEquivalentCost,
    nexusCost,
    savingsUsd,
    savingsPct,
    compliance,
  };
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const corridorAnalyticsEngine = new CorridorAnalyticsEngine();
