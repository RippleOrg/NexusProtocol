import https from "https";
import axios, { AxiosInstance } from "axios";
import { getSixMtlsCredentials } from "@/lib/integrations/six-credentials";

export interface FxRate {
  pair: string;
  rate: number;
  bid: number;
  ask: number;
  timestamp: number;
  change24h: number;
  source: "SIX_BFI";
}

export interface MetalPrice {
  metal: "XAU" | "XAG" | "XPT";
  priceUsd: number;
  timestamp: number;
  source: "SIX_BFI";
}

// VALOR_BC identifiers for NEXUS FX pairs and precious metals (BC=148)
const NEXUS_FX_PAIRS: Record<string, string> = {
  "USD/NGN": "199113_148",
  "GBP/NGN": "282981_148",
  "USD/KES": "275141_148",
  "GBP/KES": "199615_148",
  "USD/GHS": "3206444_148",
  "EUR/USD": "946681_148",
  "GBP/USD": "275017_148",
  "CHF/USD": "275164_148",
  "XAU/USD": "274702_148",
  "XAG/USD": "274720_148",
  "XPT/USD": "287635_148",
};

const SIX_BASE_URL = "https://api.six-group.com/web/v2";
const REDIS_TTL_SECONDS = 30;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

interface IntradaySnapshotEntry {
  intradaySnapshot?: {
    lastPrice?: number;
    bid?: number;
    ask?: number;
    responseDateTime?: string;
    currency?: string;
  };
}

interface IntradaySnapshotResponse {
  data?: IntradaySnapshotEntry[];
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simple in-memory cache for environments without Redis
const memoryCache = new Map<string, { value: unknown; expiresAt: number }>();

function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value as T;
}

function setCache<T>(key: string, value: T, ttlSeconds: number): void {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

// Build MTLS agent from cert/key env vars. Returns undefined when vars are absent
// (e.g. local dev / CI without certs). Agent is cached after first build.
let _httpsAgent: https.Agent | undefined | null = null;

function buildHttpsAgent(): https.Agent | undefined {
  if (_httpsAgent !== null) return _httpsAgent;
  const credentials = getSixMtlsCredentials();
  if (!credentials) {
    _httpsAgent = undefined;
    return undefined;
  }
  _httpsAgent = new https.Agent({
    cert: credentials.cert,
    key: credentials.key,
    passphrase: credentials.passphrase,
  });
  return _httpsAgent;
}

export class SixBfiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: SIX_BASE_URL,
      timeout: 10_000,
      headers: {
        Accept: "application/json",
      },
      httpsAgent: buildHttpsAgent(),
    });
  }

  private async retryRequest<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error = new Error("Unknown error");
    for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < RETRY_ATTEMPTS - 1) {
          await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
        }
      }
    }
    throw lastError;
  }

  private async fetchIntradaySnapshot(
    valorBc: string
  ): Promise<IntradaySnapshotEntry> {
    const response = await this.client.get<IntradaySnapshotResponse>(
      `/listings/marketData/intradaySnapshot`,
      { params: { scheme: "VALOR_BC", ids: valorBc } }
    );
    const entries = response.data?.data;
    if (!entries || entries.length === 0) {
      throw new Error(
        `No intradaySnapshot data returned for VALOR_BC ${valorBc}`
      );
    }
    return entries[0];
  }

  async getFxRate(base: string, quote: string): Promise<FxRate> {
    const pairKey = `${base}/${quote}`;
    const valorBc = NEXUS_FX_PAIRS[pairKey];
    if (!valorBc) {
      throw new Error(`Unsupported FX pair: ${pairKey}`);
    }

    const pair = `${base}${quote}`;
    const cacheKey = `six_bfi_rate_${pair}`;
    const cached = getCached<FxRate>(cacheKey);
    if (cached) return cached;

    const rate = await this.retryRequest(async () => {
      const entry = await this.fetchIntradaySnapshot(valorBc);
      const snap = entry.intradaySnapshot;
      if (!snap) {
        throw new Error(`Missing intradaySnapshot in response for ${pairKey}`);
      }
      if (snap.lastPrice == null || snap.bid == null || snap.ask == null) {
        throw new Error(
          `Incomplete price data in intradaySnapshot for ${pairKey}: lastPrice=${snap.lastPrice}, bid=${snap.bid}, ask=${snap.ask}`
        );
      }
      const fxRate: FxRate = {
        pair,
        rate: snap.lastPrice,
        bid: snap.bid,
        ask: snap.ask,
        timestamp: snap.responseDateTime
          ? new Date(snap.responseDateTime).getTime()
          : Date.now(),
        change24h: 0,
        source: "SIX_BFI",
      };
      return fxRate;
    });

    setCache(cacheKey, rate, REDIS_TTL_SECONDS);
    return rate;
  }

  async getFxRates(pairs: string[]): Promise<FxRate[]> {
    return Promise.all(
      pairs.map((pair) => {
        const [base, quote] = [pair.slice(0, 3), pair.slice(3)];
        return this.getFxRate(base, quote);
      })
    );
  }

  async getMetalPrice(metal: "XAU" | "XAG" | "XPT"): Promise<MetalPrice> {
    const pairKey = `${metal}/USD`;
    const valorBc = NEXUS_FX_PAIRS[pairKey];
    if (!valorBc) {
      throw new Error(`Unsupported metal: ${metal}`);
    }

    const cacheKey = `six_bfi_metal_${metal}`;
    const cached = getCached<MetalPrice>(cacheKey);
    if (cached) return cached;

    const price = await this.retryRequest(async () => {
      const entry = await this.fetchIntradaySnapshot(valorBc);
      const snap = entry.intradaySnapshot;
      if (!snap) {
        throw new Error(`Missing intradaySnapshot in response for ${pairKey}`);
      }
      if (snap.lastPrice == null) {
        throw new Error(
          `lastPrice missing in intradaySnapshot for ${pairKey}`
        );
      }
      const metalPrice: MetalPrice = {
        metal,
        priceUsd: snap.lastPrice,
        timestamp: snap.responseDateTime
          ? new Date(snap.responseDateTime).getTime()
          : Date.now(),
        source: "SIX_BFI",
      };
      return metalPrice;
    });

    setCache(cacheKey, price, REDIS_TTL_SECONDS);
    return price;
  }

  validateRateAgainstBand(
    offered: number,
    reference: number,
    bandBps: number
  ): boolean {
    if (reference === 0) return false;
    const deviationBps = (Math.abs(offered - reference) / reference) * 10_000;
    return deviationBps <= bandBps;
  }
}

let _sixBfiClient: SixBfiClient | null = null;

export function getSixBfiClient() {
  if (!_sixBfiClient) {
    _sixBfiClient = new SixBfiClient();
  }

  return _sixBfiClient;
}
