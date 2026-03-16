import WebSocket from "ws";
import { EventEmitter } from "events";

// ─── Configuration ─────────────────────────────────────────────────────────

export interface SolstreamConfig {
  endpoint: string;  // from env SOLSTREAM_ENDPOINT
  apiKey: string;    // from env SOLSTREAM_API_KEY
  programId: string; // NEXUS_PROGRAM_ID
}

function buildConfig(): SolstreamConfig {
  const programId =
    process.env.NEXT_PUBLIC_NEXUS_PROGRAM_ID ??
    "NXSvFssBwGNZPpPSS5tcMqQLYbFf8yRKXBiARUdGi7Mb";
  const endpoint =
    process.env.SOLSTREAM_ENDPOINT ??
    `wss://stream.solstice.sh/v1/${programId}`;
  const apiKey = process.env.SOLSTREAM_API_KEY ?? "";
  if (!apiKey) {
    console.warn(
      "[Solstream] SOLSTREAM_API_KEY is not set — connecting without authentication"
    );
  }
  return { endpoint, apiKey, programId };
}

// ─── Compliance Event Types ────────────────────────────────────────────────
// Mirrors the Anchor #[event] structs in programs/nexus/src/events.rs

export interface EscrowCreatedEvent {
  type: "EscrowCreated";
  escrowId: string;
  importer: string;
  exporter: string;
  amount: string;
  tokenMint: string;
  conditionsCount: number;
  expiresAt: number;
  timestamp: number;
}

export interface EscrowFundedEvent {
  type: "EscrowFunded";
  escrowId: string;
  importer: string;
  amount: string;
  timestamp: number;
}

export interface EscrowSettledEvent {
  type: "EscrowSettled";
  escrowId: string;
  importer: string;
  exporter: string;
  baseAmount: string;
  fxRate: string;
  settlementAmount: string;
  settlementCurrency: string;
  settlementMs: string;
  travelRuleLog: string;
  timestamp: number;
}

export interface KycRegisteredEvent {
  type: "KycRegistered";
  institutionId: string;
  wallet: string;
  tier: number;
  jurisdiction: string;
  timestamp: number;
}

export interface KycRevokedEvent {
  type: "KycRevoked";
  institutionId: string;
  revokedBy: string;
  timestamp: number;
}

export interface TravelRuleEmittedEvent {
  type: "TravelRuleEmitted";
  logId: string;
  escrow: string;
  transferAmount: string;
  originatorInstitutionId: string;
  beneficiaryInstitutionId: string;
  timestamp: number;
}

export interface AmlFlagRaisedEvent {
  type: "AmlFlagRaised";
  wallet: string;
  institutionId: string;
  riskScore: number;
  timestamp: number;
}

export interface DisputeRaisedEvent {
  type: "DisputeRaised";
  escrowId: string;
  importer: string;
  reason: string;
  timestamp: number;
}

export interface DisputeResolvedEvent {
  type: "DisputeResolved";
  escrowId: string;
  ruling: number;
  resolvedBy: string;
  timestamp: number;
}

export interface CollateralLiquidatedEvent {
  type: "CollateralLiquidated";
  escrowId: string;
  collateralAmount: string;
  usdValueAtLiquidation: string;
  timestamp: number;
}

export type NexusComplianceEvent =
  | EscrowCreatedEvent
  | EscrowFundedEvent
  | EscrowSettledEvent
  | KycRegisteredEvent
  | KycRevokedEvent
  | TravelRuleEmittedEvent
  | AmlFlagRaisedEvent
  | DisputeRaisedEvent
  | DisputeResolvedEvent
  | CollateralLiquidatedEvent;

export type ComplianceEventType = NexusComplianceEvent["type"];

// Events that are escrow-scoped (carry an escrowId field)
const ESCROW_EVENT_TYPES = new Set<ComplianceEventType>([
  "EscrowCreated",
  "EscrowFunded",
  "EscrowSettled",
  "DisputeRaised",
  "DisputeResolved",
  "CollateralLiquidated",
]);

// Events that are institution-scoped (carry an institutionId or originator/beneficiary)
const INSTITUTION_EVENT_TYPES = new Set<ComplianceEventType>([
  "KycRegistered",
  "KycRevoked",
  "AmlFlagRaised",
  "TravelRuleEmitted",
]);

// All compliance-relevant event type names (used for filtering incoming stream messages)
const COMPLIANCE_EVENT_TYPES = new Set<string>([
  "EscrowCreated",
  "EscrowFunded",
  "EscrowSettled",
  "KycRegistered",
  "KycRevoked",
  "TravelRuleEmitted",
  "AmlFlagRaised",
  "DisputeRaised",
  "DisputeResolved",
  "CollateralLiquidated",
]);

// ─── Raw Solstream wire format ─────────────────────────────────────────────

interface SolstreamMessage {
  // Solstream wraps each Anchor program event as:
  // { type: "event", name: "<EventName>", data: { ...fields }, txSignature: "...", slot: ... }
  type: string;
  name?: string;
  data?: Record<string, unknown>;
  txSignature?: string;
  slot?: number;
}

// ─── Ring Buffer ───────────────────────────────────────────────────────────

const RING_BUFFER_SIZE = 500;

// ─── SolstreamClient ──────────────────────────────────────────────────────

const MAX_BACKOFF_MS = 30_000;

export class SolstreamClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: SolstreamConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed = false;

  // In-memory ring buffer of recent compliance events
  private recentEvents: NexusComplianceEvent[] = [];

  // Per-escrow subscribers: escrowId -> set of callbacks
  private escrowSubscribers = new Map<
    string,
    Set<(event: NexusComplianceEvent) => void>
  >();

  // Per-institution subscribers: institutionId -> set of callbacks
  private institutionSubscribers = new Map<
    string,
    Set<(event: NexusComplianceEvent) => void>
  >();

  constructor(config?: SolstreamConfig) {
    super();
    this.config = config ?? buildConfig();
  }

  // ── Connection ────────────────────────────────────────────────────────

  connect(): void {
    if (this.isDestroyed) return;

    const headers: Record<string, string> = {};
    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    try {
      this.ws = new WebSocket(this.config.endpoint, { headers });
    } catch (err) {
      console.error("[Solstream] Failed to create WebSocket:", err);
      this.scheduleReconnect();
      return;
    }

    this.ws.on("open", () => {
      console.log(
        `[Solstream] Connected to ${this.config.endpoint} (program: ${this.config.programId})`
      );
      this.reconnectAttempts = 0;
    });

    this.ws.on("message", (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString()) as SolstreamMessage;
        this.handleMessage(msg);
      } catch (err) {
        console.error("[Solstream] Failed to parse message:", err);
      }
    });

    this.ws.on("error", (err) => {
      console.error("[Solstream] WebSocket error:", err.message);
    });

    this.ws.on("close", (code, reason) => {
      console.warn(
        `[Solstream] Connection closed (code=${code}, reason=${reason.toString()})`
      );
      if (!this.isDestroyed) {
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed) return;
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      MAX_BACKOFF_MS
    );
    this.reconnectAttempts++;
    console.log(
      `[Solstream] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
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

  // ── Message handling ─────────────────────────────────────────────────

  private handleMessage(msg: SolstreamMessage): void {
    // Only process Anchor event notifications
    if (msg.type !== "event" || !msg.name) return;

    // Filter for compliance-relevant event types
    if (!COMPLIANCE_EVENT_TYPES.has(msg.name)) return;

    const event = this.parseEvent(msg.name, msg.data ?? {});
    if (!event) return;

    // Append to ring buffer
    this.recentEvents.push(event);
    if (this.recentEvents.length > RING_BUFFER_SIZE) {
      this.recentEvents.shift();
    }

    // Notify global compliance subscribers
    this.emit("compliance_event", event);

    // Notify escrow-specific subscribers
    if (ESCROW_EVENT_TYPES.has(event.type)) {
      const escrowId = this.getEscrowId(event);
      if (escrowId) {
        const subs = this.escrowSubscribers.get(escrowId);
        if (subs) {
          for (const cb of subs) {
            try {
              cb(event);
            } catch (err) {
              console.error(
                `[Solstream] Escrow subscriber error for ${escrowId}:`,
                err
              );
            }
          }
        }
      }
    }

    // Notify institution-specific subscribers
    if (INSTITUTION_EVENT_TYPES.has(event.type)) {
      const ids = this.getInstitutionIds(event);
      for (const institutionId of ids) {
        const subs = this.institutionSubscribers.get(institutionId);
        if (subs) {
          for (const cb of subs) {
            try {
              cb(event);
            } catch (err) {
              console.error(
                `[Solstream] Institution subscriber error for ${institutionId}:`,
                err
              );
            }
          }
        }
      }
    }
  }

  private parseEvent(
    name: string,
    data: Record<string, unknown>
  ): NexusComplianceEvent | null {
    const str = (key: string) => String(data[key] ?? "");
    const num = (key: string) => Number(data[key] ?? 0);

    switch (name) {
      case "EscrowCreated":
        return {
          type: "EscrowCreated",
          escrowId: str("escrow_id"),
          importer: str("importer"),
          exporter: str("exporter"),
          amount: str("amount"),
          tokenMint: str("token_mint"),
          conditionsCount: num("conditions_count"),
          expiresAt: num("expires_at"),
          timestamp: num("timestamp"),
        };

      case "EscrowFunded":
        return {
          type: "EscrowFunded",
          escrowId: str("escrow_id"),
          importer: str("importer"),
          amount: str("amount"),
          timestamp: num("timestamp"),
        };

      case "EscrowSettled":
        return {
          type: "EscrowSettled",
          escrowId: str("escrow_id"),
          importer: str("importer"),
          exporter: str("exporter"),
          baseAmount: str("base_amount"),
          fxRate: str("fx_rate"),
          settlementAmount: str("settlement_amount"),
          settlementCurrency: str("settlement_currency"),
          settlementMs: str("settlement_ms"),
          travelRuleLog: str("travel_rule_log"),
          timestamp: num("timestamp"),
        };

      case "KycRegistered":
        return {
          type: "KycRegistered",
          institutionId: str("institution_id"),
          wallet: str("wallet"),
          tier: num("tier"),
          jurisdiction: str("jurisdiction"),
          timestamp: num("timestamp"),
        };

      case "KycRevoked":
        return {
          type: "KycRevoked",
          institutionId: str("institution_id"),
          revokedBy: str("revoked_by"),
          timestamp: num("timestamp"),
        };

      case "TravelRuleEmitted":
        return {
          type: "TravelRuleEmitted",
          logId: str("log_id"),
          escrow: str("escrow"),
          transferAmount: str("transfer_amount"),
          originatorInstitutionId: str("originator_institution_id"),
          beneficiaryInstitutionId: str("beneficiary_institution_id"),
          timestamp: num("timestamp"),
        };

      case "AmlFlagRaised":
        return {
          type: "AmlFlagRaised",
          wallet: str("wallet"),
          institutionId: str("institution_id"),
          riskScore: num("risk_score"),
          timestamp: num("timestamp"),
        };

      case "DisputeRaised":
        return {
          type: "DisputeRaised",
          escrowId: str("escrow_id"),
          importer: str("importer"),
          reason: str("reason"),
          timestamp: num("timestamp"),
        };

      case "DisputeResolved":
        return {
          type: "DisputeResolved",
          escrowId: str("escrow_id"),
          ruling: num("ruling"),
          resolvedBy: str("resolved_by"),
          timestamp: num("timestamp"),
        };

      case "CollateralLiquidated":
        return {
          type: "CollateralLiquidated",
          escrowId: str("escrow_id"),
          collateralAmount: str("collateral_amount"),
          usdValueAtLiquidation: str("usd_value_at_liquidation"),
          timestamp: num("timestamp"),
        };

      default:
        return null;
    }
  }

  // Return the escrowId if the event is escrow-scoped
  private getEscrowId(event: NexusComplianceEvent): string | null {
    if (
      event.type === "EscrowCreated" ||
      event.type === "EscrowFunded" ||
      event.type === "EscrowSettled" ||
      event.type === "DisputeRaised" ||
      event.type === "DisputeResolved" ||
      event.type === "CollateralLiquidated"
    ) {
      return event.escrowId;
    }
    return null;
  }

  // Return all institution IDs referenced by the event
  private getInstitutionIds(event: NexusComplianceEvent): string[] {
    switch (event.type) {
      case "KycRegistered":
        return [event.institutionId];
      case "KycRevoked":
        return [event.institutionId];
      case "AmlFlagRaised":
        return [event.institutionId];
      case "TravelRuleEmitted":
        return [
          event.originatorInstitutionId,
          event.beneficiaryInstitutionId,
        ].filter(Boolean);
      default:
        return [];
    }
  }

  // ── Public subscription API ───────────────────────────────────────────

  /**
   * Subscribe to all compliance-relevant events from the NEXUS program.
   * Returns an unsubscribe function.
   */
  onComplianceEvent(
    callback: (event: NexusComplianceEvent) => void
  ): () => void {
    this.on("compliance_event", callback);
    return () => {
      this.off("compliance_event", callback);
    };
  }

  /**
   * Subscribe to all compliance events for a specific escrow.
   * Fires for: EscrowCreated, EscrowFunded, EscrowSettled,
   *            DisputeRaised, DisputeResolved, CollateralLiquidated.
   * Returns an unsubscribe function.
   */
  onEscrowEvent(
    escrowId: string,
    callback: (event: NexusComplianceEvent) => void
  ): () => void {
    if (!this.escrowSubscribers.has(escrowId)) {
      this.escrowSubscribers.set(escrowId, new Set());
    }
    this.escrowSubscribers.get(escrowId)!.add(callback);

    return () => {
      this.escrowSubscribers.get(escrowId)?.delete(callback);
    };
  }

  /**
   * Subscribe to all compliance events involving a specific institution.
   * Fires for: KycRegistered, KycRevoked, AmlFlagRaised, TravelRuleEmitted.
   * Returns an unsubscribe function.
   */
  onInstitutionEvent(
    institutionId: string,
    callback: (event: NexusComplianceEvent) => void
  ): () => void {
    if (!this.institutionSubscribers.has(institutionId)) {
      this.institutionSubscribers.set(institutionId, new Set());
    }
    this.institutionSubscribers.get(institutionId)!.add(callback);

    return () => {
      this.institutionSubscribers.get(institutionId)?.delete(callback);
    };
  }

  /**
   * Return recent events from the in-memory ring buffer, optionally filtered
   * by event type.  Results are newest-first.
   */
  getRecentEvents(
    type: ComplianceEventType | "all",
    limit = 50
  ): NexusComplianceEvent[] {
    const events =
      type === "all"
        ? [...this.recentEvents]
        : this.recentEvents.filter((e) => e.type === type);
    return events.reverse().slice(0, limit);
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

let _solstreamClient: SolstreamClient | null = null;

/** Return (and lazily create) the module-level singleton SolstreamClient. */
export function getSolstreamClient(): SolstreamClient {
  if (!_solstreamClient) {
    _solstreamClient = new SolstreamClient();
    _solstreamClient.connect();
  }
  return _solstreamClient;
}
