import WebSocket from "ws";
import https from "https";
import { EventEmitter } from "events";
import { getSixMtlsCredentials } from "@/lib/integrations/six-credentials";

export interface StreamRate {
  valorBc: string;
  pair: string;
  lastPrice: number;
  bid: number;
  ask: number;
  change24h: number;
  changePct24h: number;
  timestamp: number;
  isStale: boolean; // true if no update for >60 seconds
}

export interface RateUpdateEvent {
  type: "rate_update";
  rate: StreamRate;
}

const SIX_STREAM_URL =
  "wss://api.six-group.com/web/v2/listings/marketData/stream";

const STALE_THRESHOLD_MS = 60_000;
const MAX_BACKOFF_MS = 30_000;

// VALOR_BC pair labels for display
const VALOR_BC_LABELS: Record<string, string> = {
  "199113_148": "USD/NGN",
  "282981_148": "GBP/NGN",
  "275141_148": "USD/KES",
  "199615_148": "GBP/KES",
  "3206444_148": "USD/GHS",
  "946681_148": "EUR/USD",
  "275017_148": "GBP/USD",
  "275164_148": "CHF/USD",
  "274702_148": "XAU/USD",
  "274720_148": "XAG/USD",
  "287635_148": "XPT/USD",
  "283501_148": "XPD/USD",
};

export class SixBfiStreamClient extends EventEmitter {
  // Error suppression state
  private lastErrorMsg: string | null = null;
  private lastErrorTime: number = 0;
  // VALOR_BC subscriptions for NEXUS (BC=148)
  private readonly NEXUS_SUBSCRIPTIONS = [
    "199113_148", // USD/NGN
    "282981_148", // GBP/NGN
    "275141_148", // USD/KES
    "199615_148", // GBP/KES
    "3206444_148", // USD/GHS
    "946681_148", // EUR/USD
    "275017_148", // GBP/USD
    "275164_148", // CHF/USD
    "274702_148", // Gold 1oz (GLDUZ)
    "274720_148", // Silver 1oz
    "287635_148", // Platinum 1oz
    "283501_148", // Palladium 1oz
  ];

  private ws: WebSocket | null = null;
  private rateCache = new Map<string, StreamRate>();
  private subscribers = new Map<string, Set<(rate: StreamRate) => void>>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed = false;

  private buildTlsAgent(): https.Agent | undefined {
    const credentials = getSixMtlsCredentials();
    if (!credentials) return undefined;
    return new https.Agent({
      cert: credentials.cert,
      key: credentials.key,
      passphrase: credentials.passphrase,
    });
  }

  connect(): void {
    if (this.isDestroyed) return;

    const agent = this.buildTlsAgent();
    if (!agent) {
      return;
    }
    const wsOptions: WebSocket.ClientOptions = agent ? { agent } : {};

    try {
      this.ws = new WebSocket(SIX_STREAM_URL, wsOptions);
    } catch (err) {
      console.error("[SixBfiStream] Failed to create WebSocket:", err);
      this.scheduleReconnect();
      return;
    }

    this.ws.on("open", () => {
      console.log("[SixBfiStream] Connected to SIX BFI stream");
      this.reconnectAttempts = 0;

      // Send subscription for all NEXUS pairs
      const subscribeMessage = {
        type: "subscribe",
        scheme: "VALOR_BC",
        ids: this.NEXUS_SUBSCRIPTIONS,
      };
      this.ws?.send(JSON.stringify(subscribeMessage));
    });

    this.ws.on("message", (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        this.handleMessage(msg);
      } catch (err) {
        console.error("[SixBfiStream] Failed to parse message:", err);
      }
    });


    this.ws.on("error", (err) => {
      const now = Date.now();
      const msg = `[SixBfiStream] WebSocket error: ${err.message}`;
      if (msg !== this.lastErrorMsg || now - this.lastErrorTime > 60000) {
        console.error(msg);
        this.lastErrorMsg = msg;
        this.lastErrorTime = now;
      }
    });

    this.ws.on("close", (code, reason) => {
      const now = Date.now();
      const msg = `[SixBfiStream] Connection closed (code=${code}, reason=${reason.toString()})`;
      if (msg !== this.lastErrorMsg || now - this.lastErrorTime > 60000) {
        console.warn(msg);
        this.lastErrorMsg = msg;
        this.lastErrorTime = now;
      }
      if (!this.isDestroyed) {
        this.scheduleReconnect();
      }
    });
  }

  private handleMessage(msg: Record<string, unknown>): void {
    // SIX BFI stream messages carry intraday snapshot fields
    const valorBc = (msg["id"] ?? msg["valorBc"]) as string | undefined;
    if (!valorBc) return;

    const snap = (msg["intradaySnapshot"] ?? msg) as Record<string, unknown>;
    const lastPrice = snap["lastPrice"] as number | undefined;
    const bid = snap["bid"] as number | undefined;
    const ask = snap["ask"] as number | undefined;

    if (lastPrice == null) return;

    const rate: StreamRate = {
      valorBc,
      pair: VALOR_BC_LABELS[valorBc] ?? valorBc,
      lastPrice,
      bid: bid ?? lastPrice,
      ask: ask ?? lastPrice,
      change24h: (snap["change24h"] as number) ?? 0,
      changePct24h: (snap["changePct24h"] as number) ?? 0,
      timestamp: Date.now(),
      isStale: false,
    };

    this.rateCache.set(valorBc, rate);

    // Notify subscribers
    const subs = this.subscribers.get(valorBc);
    if (subs) {
      for (const cb of subs) {
        try {
          cb(rate);
        } catch (err) {
          console.error(`[SixBfiStream] Subscriber error for ${valorBc}:`, err);
        }
      }
    }

    this.emit("rate_update", { type: "rate_update", rate } as RateUpdateEvent);
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed) return;
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      MAX_BACKOFF_MS
    );
    this.reconnectAttempts++;
    console.log(
      `[SixBfiStream] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  subscribe(valorBc: string, callback: (rate: StreamRate) => void): () => void {
    if (!this.subscribers.has(valorBc)) {
      this.subscribers.set(valorBc, new Set());
    }
    this.subscribers.get(valorBc)!.add(callback);

    return () => {
      this.subscribers.get(valorBc)?.delete(callback);
    };
  }

  getLatestRate(valorBc: string): StreamRate | null {
    const rate = this.rateCache.get(valorBc) ?? null;
    if (!rate) return null;
    const isStale = Date.now() - rate.timestamp > STALE_THRESHOLD_MS;
    return { ...rate, isStale };
  }

  disconnect(): void {
    this.isDestroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton stream client (server-side only)
let _streamClient: SixBfiStreamClient | null = null;

export function getStreamClient(): SixBfiStreamClient {
  if (!_streamClient) {
    _streamClient = new SixBfiStreamClient();
    _streamClient.connect();
  }
  return _streamClient;
}
