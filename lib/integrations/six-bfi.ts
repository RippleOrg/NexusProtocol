import axios, { AxiosInstance } from "axios";

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

const REDIS_TTL_SECONDS = 30;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

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

export class SixBfiClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey ?? process.env.SIX_BFI_API_KEY ?? "";
    this.baseUrl =
      baseUrl ??
      process.env.SIX_BFI_BASE_URL ??
      "https://api.six-group.com/api/findata/v1";
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10_000,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
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

  async getFxRate(base: string, quote: string): Promise<FxRate> {
    const pair = `${base}${quote}`;
    const cacheKey = `six_bfi_rate_${pair}`;
    const cached = getCached<FxRate>(cacheKey);
    if (cached) return cached;

    const rate = await this.retryRequest(async () => {
      const response = await this.client.get<{
        data: {
          rate: number;
          bid: number;
          ask: number;
          timestamp: string;
          change24h: number;
        };
      }>(`/fx-rates/${pair}`);
      const rateData = response.data.data;
      const fxRate: FxRate = {
        pair,
        rate: rateData.rate,
        bid: rateData.bid,
        ask: rateData.ask,
        timestamp: new Date(rateData.timestamp).getTime(),
        change24h: rateData.change24h ?? 0,
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
    const cacheKey = `six_bfi_metal_${metal}`;
    const cached = getCached<MetalPrice>(cacheKey);
    if (cached) return cached;

    const price = await this.retryRequest(async () => {
      const response = await this.client.get<{
        data: { price: number; timestamp: string };
      }>(`/metals/${metal}/USD`);
      const metalData = response.data.data;
      const metalPrice: MetalPrice = {
        metal,
        priceUsd: metalData.price,
        timestamp: new Date(metalData.timestamp).getTime(),
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

export const sixBfiClient = new SixBfiClient();
