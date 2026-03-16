"use client";

import { useEffect, useRef, useState } from "react";
import type { NexusComplianceEvent, ComplianceEventType } from "@/lib/integrations/solstream";

// ── SSE message types ──────────────────────────────────────────────────────

type StreamMessage =
  | { type: "connected"; streaming: boolean }
  | { type: "snapshot"; events: NexusComplianceEvent[] }
  | { type: "compliance_event"; event: NexusComplianceEvent }
  | { type: "heartbeat"; streaming: boolean; timestamp: number };

// ── Per-event-type display metadata ───────────────────────────────────────

interface EventMeta {
  icon: string;
  label: string;
  badgeClass: string;
  rowClass: string;
}

const EVENT_META: Record<ComplianceEventType, EventMeta> = {
  EscrowCreated: {
    icon: "📋",
    label: "Escrow Created",
    badgeClass: "bg-blue-900/50 text-blue-400 border-blue-800",
    rowClass: "",
  },
  EscrowFunded: {
    icon: "💰",
    label: "Escrow Funded",
    badgeClass: "bg-cyan-900/50 text-cyan-400 border-cyan-800",
    rowClass: "",
  },
  EscrowSettled: {
    icon: "✅",
    label: "Escrow Settled",
    badgeClass: "bg-green-900/50 text-green-400 border-green-800",
    rowClass: "",
  },
  KycRegistered: {
    icon: "🪪",
    label: "KYC Registered",
    badgeClass: "bg-purple-900/50 text-purple-400 border-purple-800",
    rowClass: "",
  },
  KycRevoked: {
    icon: "🚫",
    label: "KYC Revoked",
    badgeClass: "bg-red-900/50 text-red-400 border-red-800",
    rowClass: "border-l-2 border-red-700",
  },
  TravelRuleEmitted: {
    icon: "✈️",
    label: "Travel Rule",
    badgeClass: "bg-indigo-900/50 text-indigo-400 border-indigo-800",
    rowClass: "",
  },
  AmlFlagRaised: {
    icon: "⚠️",
    label: "AML Flag",
    badgeClass: "bg-orange-900/50 text-orange-400 border-orange-800",
    rowClass: "border-l-2 border-orange-700",
  },
  DisputeRaised: {
    icon: "⚖️",
    label: "Dispute Raised",
    badgeClass: "bg-yellow-900/50 text-yellow-400 border-yellow-800",
    rowClass: "border-l-2 border-yellow-700",
  },
  DisputeResolved: {
    icon: "🔨",
    label: "Dispute Resolved",
    badgeClass: "bg-teal-900/50 text-teal-400 border-teal-800",
    rowClass: "",
  },
  CollateralLiquidated: {
    icon: "💥",
    label: "Collateral Liquidated",
    badgeClass: "bg-red-900/50 text-red-400 border-red-800",
    rowClass: "border-l-2 border-red-700",
  },
};

// ── Event detail summary (one-liner per type) ──────────────────────────────

function summariseEvent(event: NexusComplianceEvent): string {
  switch (event.type) {
    case "EscrowCreated":
      return `${event.escrowId} — importer ${event.importer.slice(0, 8)}…`;
    case "EscrowFunded":
      return `${event.escrowId} — ${Number(event.amount) / 1_000_000} USDC`;
    case "EscrowSettled":
      return `${event.escrowId} — settled ${Number(event.settlementAmount) / 1_000_000} USDC`;
    case "KycRegistered":
      return `${event.institutionId} — Tier ${event.tier} (${event.jurisdiction})`;
    case "KycRevoked":
      return `${event.institutionId} revoked by ${event.revokedBy.slice(0, 8)}…`;
    case "TravelRuleEmitted":
      return `${event.originatorInstitutionId} → ${event.beneficiaryInstitutionId}`;
    case "AmlFlagRaised":
      return `${event.institutionId} — risk score ${event.riskScore}/100`;
    case "DisputeRaised":
      return `${event.escrowId} — "${event.reason.slice(0, 40)}${event.reason.length > 40 ? "…" : ""}"`;
    case "DisputeResolved":
      return `${event.escrowId} — ruling ${event.ruling === 0 ? "importer" : "exporter"}`;
    case "CollateralLiquidated":
      return `${event.escrowId} — liquidated`;
  }
}

// ── Filter options ─────────────────────────────────────────────────────────

const ALL_TYPES = Object.keys(EVENT_META) as ComplianceEventType[];
const DEFAULT_MAX_ROWS = 100;

// ── Component ──────────────────────────────────────────────────────────────

interface ComplianceEventFeedProps {
  /** Only show events for a specific escrow (optional) */
  escrowId?: string;
  /** Only show events for a specific institution (optional) */
  institutionId?: string;
  /** Maximum rows to keep in the feed (default: DEFAULT_MAX_ROWS) */
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

  // Add a new event (or a batch) and keep the list capped at maxRows
  const addEvents = (incoming: NexusComplianceEvent[]) => {
    setEvents((prev) => {
      const combined = [...incoming, ...prev];
      return combined.slice(0, maxRows);
    });

    // Flash each new event row briefly
    for (const e of incoming) {
      const key = `${e.type}-${e.timestamp}`;
      setFlashKeys((s) => new Set(s).add(key));
      const t = setTimeout(() => {
        setFlashKeys((s) => {
          const next = new Set(s);
          next.delete(key);
          return next;
        });
        newEventTimers.current.delete(key);
      }, 800);
      newEventTimers.current.set(key, t);
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

    es.onmessage = (ev: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(ev.data) as StreamMessage;

        if (msg.type === "connected") {
          setIsStreaming(msg.streaming);
        } else if (msg.type === "heartbeat") {
          setIsStreaming(msg.streaming);
        } else if (msg.type === "snapshot") {
          addEvents(msg.events);
        } else if (msg.type === "compliance_event") {
          addEvents([msg.event]);
        }
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      es.close();
      esRef.current = null;
      for (const t of newEventTimers.current.values()) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply prop-level and filter-level filters
  const visibleEvents = events.filter((e) => {
    if (activeFilter !== "all" && e.type !== activeFilter) return false;
    if (escrowId) {
      if (
        e.type !== "EscrowCreated" &&
        e.type !== "EscrowFunded" &&
        e.type !== "EscrowSettled" &&
        e.type !== "DisputeRaised" &&
        e.type !== "DisputeResolved" &&
        e.type !== "CollateralLiquidated"
      )
        return false;
      const escrowEvent = e as Extract<
        NexusComplianceEvent,
        { escrowId: string }
      >;
      if (escrowEvent.escrowId !== escrowId) return false;
    }
    if (institutionId) {
      if (e.type === "KycRegistered" || e.type === "KycRevoked" || e.type === "AmlFlagRaised") {
        if ((e as { institutionId: string }).institutionId !== institutionId)
          return false;
      } else if (e.type === "TravelRuleEmitted") {
        if (
          e.originatorInstitutionId !== institutionId &&
          e.beneficiaryInstitutionId !== institutionId
        )
          return false;
      } else {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-semibold text-sm">
            Compliance Event Feed
          </h3>
          {isStreaming ? (
            <span className="flex items-center gap-1 bg-green-900/40 text-green-400 text-xs px-2 py-0.5 rounded-full border border-green-800">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="flex items-center gap-1 bg-yellow-900/40 text-yellow-400 text-xs px-2 py-0.5 rounded-full border border-yellow-800">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              {isConnected ? "BUFFERED" : "OFFLINE"}
            </span>
          )}
        </div>
        <span className="text-gray-500 text-xs">
          {visibleEvents.length} event{visibleEvents.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Type filter pills */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-gray-800 overflow-x-auto">
        <button
          onClick={() => setActiveFilter("all")}
          className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
            activeFilter === "all"
              ? "bg-gray-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
        >
          All
        </button>
        {ALL_TYPES.map((t) => {
          const meta = EVENT_META[t];
          return (
            <button
              key={t}
              onClick={() =>
                setActiveFilter((prev) => (prev === t ? "all" : t))
              }
              className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                activeFilter === t
                  ? meta.badgeClass
                  : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"
              }`}
            >
              {meta.icon} {meta.label}
            </button>
          );
        })}
      </div>

      {/* Event list */}
      <div className="divide-y divide-gray-800/60 max-h-[480px] overflow-y-auto">
        {visibleEvents.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-gray-500 text-sm">
            {isConnected ? (
              <>
                <span className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin mr-2" />
                Waiting for compliance events…
              </>
            ) : (
              "Not connected to Solstream"
            )}
          </div>
        ) : (
          visibleEvents.map((e) => {
            const meta = EVENT_META[e.type];
            const key = `${e.type}-${e.timestamp}`;
            const isNew = flashKeys.has(key);

            return (
              <div
                key={key}
                className={`flex items-center gap-3 px-4 py-3 transition-colors duration-500 ${
                  isNew ? "bg-white/5" : "hover:bg-gray-800/30"
                } ${meta.rowClass}`}
              >
                {/* Icon */}
                <span className="text-base shrink-0">{meta.icon}</span>

                {/* Badge */}
                <span
                  className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${meta.badgeClass}`}
                >
                  {meta.label}
                </span>

                {/* Summary */}
                <span className="flex-1 text-gray-300 text-xs font-mono truncate">
                  {summariseEvent(e)}
                </span>

                {/* Timestamp */}
                <span className="shrink-0 text-gray-500 text-xs">
                  {new Date(e.timestamp * 1000).toLocaleTimeString()}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
