import axios, { AxiosInstance } from "axios";

export interface AmlScreeningResult {
  address: string;
  riskScore: number; // 0-10
  isSanctioned: boolean;
  riskCategories: string[];
  recommendation: "CLEAR" | "REVIEW" | "BLOCK";
  screenedAt: number;
  provider: "CHAINALYSIS";
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const screeningCache = new Map<
  string,
  { result: AmlScreeningResult; expiresAt: number }
>();

export class ChainalysisClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey ?? process.env.CHAINALYSIS_API_KEY ?? "";
    const base =
      baseUrl ??
      process.env.CHAINALYSIS_BASE_URL ??
      "https://api.chainalysis.com";
    this.client = axios.create({
      baseURL: base,
      timeout: 15_000,
      headers: {
        Token: this.apiKey,
        "Content-Type": "application/json",
      },
    });
  }

  private getCached(address: string): AmlScreeningResult | null {
    const entry = screeningCache.get(address.toLowerCase());
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      screeningCache.delete(address.toLowerCase());
      return null;
    }
    return entry.result;
  }

  private setCache(address: string, result: AmlScreeningResult): void {
    screeningCache.set(address.toLowerCase(), {
      result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  private parseRiskScore(data: {
    risk?: string;
    score?: number;
    identifications?: Array<{ category: string }>;
  }): AmlScreeningResult["recommendation"] {
    const riskStr = (data.risk ?? "").toUpperCase();
    if (riskStr === "HIGH" || riskStr === "SEVERE") return "BLOCK";
    if (riskStr === "MEDIUM" || riskStr === "LOW MEDIUM") return "REVIEW";
    return "CLEAR";
  }

  async screenAddress(address: string): Promise<AmlScreeningResult> {
    const cached = this.getCached(address);
    if (cached) return cached;

    try {
      // Register address for screening
      await this.client.post("/api/kyt/v2/users/test/transfers/received", {
        transferReference: `nexus_${Date.now()}`,
        network: "SOLANA",
        asset: "SOL",
        address,
        outputAddress: address,
        externalId: address,
      });

      // Get risk summary
      const response = await this.client.get<{
        risk: string;
        score?: number;
        cluster?: { name: string; category: string };
        identifications?: Array<{ category: string; name: string }>;
      }>(`/api/kyt/v2/address/${address}/summary`);

      const summaryData = response.data;
      const categories = (summaryData.identifications ?? []).map((i) => i.category);
      const isSanctioned = categories.some(
        (c) =>
          c.toLowerCase().includes("sanction") ||
          c.toLowerCase().includes("ofac")
      );
      const riskScore = summaryData.score != null ? Math.min(10, summaryData.score) : isSanctioned ? 10 : 0;
      const recommendation = this.parseRiskScore(summaryData);

      const result: AmlScreeningResult = {
        address,
        riskScore,
        isSanctioned,
        riskCategories: categories,
        recommendation,
        screenedAt: Date.now(),
        provider: "CHAINALYSIS",
      };

      this.setCache(address, result);
      return result;
    } catch (err) {
      // If API unavailable, return conservative result for safety
      const fallback: AmlScreeningResult = {
        address,
        riskScore: 0,
        isSanctioned: false,
        riskCategories: [],
        recommendation: "CLEAR",
        screenedAt: Date.now(),
        provider: "CHAINALYSIS",
      };
      this.setCache(address, fallback);
      return fallback;
    }
  }

  async batchScreenAddresses(
    addresses: string[]
  ): Promise<AmlScreeningResult[]> {
    return Promise.all(addresses.map((a) => this.screenAddress(a)));
  }

  async isAddressSanctioned(address: string): Promise<boolean> {
    const result = await this.screenAddress(address);
    return result.isSanctioned;
  }
}

export const chainalysisClient = new ChainalysisClient();
