"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ComplianceEventType,
  NexusComplianceEvent,
} from "@/lib/integrations/solstream";

type StreamMessage =
  | { type: "connected"; streaming: boolean }
  | { type: "snapshot"; events: NexusComplianceEvent[] }
  | { type: "compliance_event"; event: NexusComplianceEvent }
  | { type: "heartbeat"; streaming: boolean; timestamp: number };

interface EventMeta {
  icon: string;
  label: string;
  badgeTone: "bg" | "bb" | "ba" | "br" | "bs";
  rowTone: "info" | "success" | "warning" | "critical";
}

const EVENT_META: Record<ComplianceEventType, EventMeta> = {
  EscrowCreated: {
    icon: "DOC",
    label: "Escrow Created",
    badgeTone: "bb",
    rowTone: "info",
  },
  EscrowFunded: {
    icon: "FUND",
    label: "Escrow Funded",
    badgeTone: "bb",
    rowTone: "info",
  },
  EscrowSettled: {
    icon: "DONE",
    label: "Escrow Settled",
    badgeTone: "bg",
    rowTone: "success",
  },
  KycRegistered: {
    icon: "KYC",
    label: "KYC Registered",
    badgeTone: "bg",
    rowTone: "success",
  },
  KycRevoked: {
    icon: "KYC",
    label: "KYC Revoked",
    badgeTone: "br",
    rowTone: "critical",
  },
  TravelRuleEmitted: {
    icon: "TR",
    label: "Travel Rule",
    badgeTone: "bg",
    rowTone: "success",
  },
  AmlFlagRaised: {
    icon: "AML",
    label: "AML Flag",
    badgeTone: "ba",
    rowTone: "warning",
  },
  DisputeRaised: {
    icon: "DSP",
    label: "Dispute Raised",
    badgeTone: "br",
    rowTone: "critical",
  },
  DisputeResolved: {
    icon: "DSP",
    label: "Dispute Resolved",
    badgeTone: "bg",
    rowTone: "success",
  },
  CollateralLiquidated: {
    icon: "COL",
    label: "Collateral Liquidated",
    badgeTone: "br",
    rowTone: "critical",
  },
};

function summariseEvent(event: NexusComplianceEvent): string {
  switch (event.type) {
    case "EscrowCreated":
      return `${event.escrowId} · importer ${event.importer.slice(0, 8)}...`;
    case "EscrowFunded":
      return `${event.escrowId} · ${Number(event.amount) / 1_000_000} USDC`;
    case "EscrowSettled":
      return `${event.escrowId} · settled ${Number(event.settlementAmount) / 1_000_000} USDC`;
    case "KycRegistered":
      return `${event.institutionId} · Tier ${event.tier} (${event.jurisdiction})`;
    case "KycRevoked":
      return `${event.institutionId} revoked by ${event.revokedBy.slice(0, 8)}...`;
    case "TravelRuleEmitted":
      return `${event.originatorInstitutionId} -> ${event.beneficiaryInstitutionId}`;
    case "AmlFlagRaised":
      return `${event.institutionId} · risk score ${event.riskScore}/100`;
    case "DisputeRaised":
      return `${event.escrowId} · ${event.reason.slice(0, 40)}${event.reason.length > 40 ? "..." : ""}`;
    case "DisputeResolved":
      return `${event.escrowId} · ruling ${event.ruling === 0 ? "importer" : "exporter"}`;
    case "CollateralLiquidated":
      return `${event.escrowId} · liquidated`;
  }
}

const ALL_TYPES = Object.keys(EVENT_META) as ComplianceEventType[];
const DEFAULT_MAX_ROWS = 100;

interface ComplianceEventFeedProps {
  escrowId?: string;
  institutionId?: string;
  maxRows?: number;
}

export default function ComplianceEventFeed({
  escrowId,
  institutionId,
  maxRows = DEFAULT_MAX_ROWS,
}: ComplianceEventFeedProps) {
  const [events, setEvents] = useState<NexusComplianceEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ComplianceEventType | "all">(
    "all"
  );
  const esRef = useRef<EventSource | null>(null);
  const newEventTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const [flashKeys, setFlashKeys] = useState<Set<string>>(new Set());

  const addEvents = (incoming: NexusComplianceEvent[]) => {
    setEvents((prev) => [...incoming, ...prev].slice(0, maxRows));

    for (const event of incoming) {
      const key = `${event.type}-${event.timestamp}`;
      setFlashKeys((current) => new Set(current).add(key));
      const timer = setTimeout(() => {
        setFlashKeys((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
        newEventTimers.current.delete(key);
      }, 800);
      newEventTimers.current.set(key, timer);
    }
  };

  useEffect(() => {
    const es = new EventSource("/api/compliance/events/stream");
    esRef.current = es;

    es.onopen = () => setIsConnected(true);
    es.onerror = () => {
      setIsConnected(false);
      setIsStreaming(false);
    };

    es.onmessage = (event: MessageEvent<string>) => {
      try {
        const message = JSON.parse(event.data) as StreamMessage;

        if (message.type === "connected" || message.type === "heartbeat") {
          setIsStreaming(message.streaming);
          return;
        }

        if (message.type === "snapshot") {
          addEvents(message.events);
          return;
        }

        if (message.type === "compliance_event") {
          addEvents([message.event]);
        }
      } catch {
        // ignore invalid event payloads
      }
    };

    return () => {
      es.close();
      esRef.current = null;
      for (const timer of newEventTimers.current.values()) {
        clearTimeout(timer);
      }
    };
  }, [maxRows]);

  const visibleEvents = events.filter((event) => {
    if (activeFilter !== "all" && event.type !== activeFilter) {
      return false;
    }

    if (escrowId) {
      if (
        event.type !== "EscrowCreated" &&
        event.type !== "EscrowFunded" &&
        event.type !== "EscrowSettled" &&
        event.type !== "DisputeRaised" &&
        event.type !== "DisputeResolved" &&
        event.type !== "CollateralLiquidated"
      ) {
        return false;
      }

      const escrowEvent = event as Extract<NexusComplianceEvent, { escrowId: string }>;
      if (escrowEvent.escrowId !== escrowId) {
        return false;
      }
    }

    if (institutionId) {
      if (
        event.type === "KycRegistered" ||
        event.type === "KycRevoked" ||
        event.type === "AmlFlagRaised"
      ) {
        if ((event as { institutionId: string }).institutionId !== institutionId) {
          return false;
        }
      } else if (event.type === "TravelRuleEmitted") {
        if (
          event.originatorInstitutionId !== institutionId &&
          event.beneficiaryInstitutionId !== institutionId
        ) {
          return false;
        }
      } else {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">Solstream Live Events</div>
        <span className={`badge ${isStreaming ? "bg" : isConnected ? "ba" : "bs"}`}>
          {isStreaming ? "STREAMING" : isConnected ? "BUFFERED" : "OFFLINE"}
        </span>
      </div>

      <div className="feed-filters">
        <button
          type="button"
          onClick={() => setActiveFilter("all")}
          className={`filter-pill ${activeFilter === "all" ? "is-active" : ""}`}
        >
          All
        </button>
        {ALL_TYPES.slice(0, 5).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveFilter(type)}
            className={`filter-pill ${activeFilter === type ? "is-active" : ""}`}
          >
            {EVENT_META[type].label}
          </button>
        ))}
      </div>

      <div className="panel-body" style={{ padding: "10px" }}>
        <div className="feed" style={{ maxHeight: "400px" }}>
          {visibleEvents.length === 0 ? (
            <div className="feed-item info">
              <div className="feed-time">NOW</div>
              <div className="feed-msg">
                Waiting for compliance events to arrive on the stream.
              </div>
            </div>
          ) : (
            visibleEvents.map((event) => {
              const meta = EVENT_META[event.type];
              const key = `${event.type}-${event.timestamp}`;

              return (
                <div
                  key={key}
                  className={`feed-item ${meta.rowTone} ${
                    flashKeys.has(key) ? "flash" : ""
                  }`}
                >
                  <div className="feed-time">
                    {new Date(event.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        marginBottom: "4px",
                        flexWrap: "wrap",
                      }}
                    >
                      <strong>{meta.label}</strong>
                      <span className={`badge ${meta.badgeTone}`}>{meta.icon}</span>
                    </div>
                    <div className="feed-msg">{summariseEvent(event)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
