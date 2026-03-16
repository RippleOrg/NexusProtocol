import axios, { AxiosInstance } from "axios";

export interface KeyrockQuoteRequest {
  baseCurrency: string;
  quoteCurrency: string;
  baseAmount: number;
  side: "BUY" | "SELL";
  clientId: string;
}

export interface KeyrockQuoteResponse {
  quoteId: string;
  rate: number;
  baseAmount: number;
  quoteAmount: number;
  validUntil: string;
  fees: {
    amount: number;
    currency: string;
  };
}

export interface KeyrockExecutionResponse {
  executionId: string;
  status: string;
  settledAt: string;
  actualRate: number;
}

export class KeyrockClient {
  private client: AxiosInstance;

  constructor(apiKey?: string, baseUrl?: string) {
    const key = apiKey ?? process.env.KEYROCK_API_KEY ?? "";
    const base = baseUrl ?? process.env.KEYROCK_API_URL ?? "";

    this.client = axios.create({
      baseURL: base,
      timeout: 15_000,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });
  }

  async requestQuote(
    params: KeyrockQuoteRequest
  ): Promise<KeyrockQuoteResponse> {
    const response = await this.client.post<KeyrockQuoteResponse>(
      "/v1/quotes",
      params
    );
    return response.data;
  }

  async executeQuote(quoteId: string): Promise<KeyrockExecutionResponse> {
    const response = await this.client.post<KeyrockExecutionResponse>(
      `/v1/quotes/${quoteId}/execute`
    );
    return response.data;
  }

  async getActiveQuotes(): Promise<KeyrockQuoteResponse[]> {
    const response =
      await this.client.get<KeyrockQuoteResponse[]>("/v1/quotes");
    return response.data;
  }
}

export const keyrockClient = new KeyrockClient();
