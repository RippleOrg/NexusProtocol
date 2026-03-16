"use client";

import { useEffect, useRef, useState } from "react";

interface LiveRate {
  pair: string;
  valorBc: string;
  rate: number;
  bid: number;
  ask: number;
  change24h: number;
  timestamp: number;
  flash?: "up" | "down" | null;
}

type StreamMessage =
  | { type: "connected"; streaming: boolean }
  | { type: "snapshot"; rates: LiveRate[] }
  | {
      type: "rate_update";
      pair: string;
      valorBc: string;
      rate: number;
      bid: number;
      ask: number;
      change24h: number;
      timestamp: number;
    }
  | { type: "heartbeat"; streaming: boolean; timestamp: number };

export default function FxRatesTicker() {
  const [rates, setRates] = useState<Map<string, LiveRate>>(new Map());
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  useEffect(() => {
    const es = new EventSource("/api/rates/stream");
    esRef.current = es;

    es.onopen = () => setIsConnected(true);
    es.onerror = () => {
      setIsConnected(false);
      setIsStreaming(false);
    };

    es.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as StreamMessage;

        if (msg.type === "connected") {
          setIsStreaming(msg.streaming);
        } else if (msg.type === "heartbeat") {
          setIsStreaming(msg.streaming);
        } else if (msg.type === "snapshot") {
          setRates((prev) => {
            const next = new Map(prev);
            for (const r of msg.rates) {
              next.set(r.valorBc, r);
            }
            return next;
          });
        } else if (msg.type === "rate_update") {
          setRates((prev) => {
            const existing = prev.get(msg.valorBc);
            const flash: "up" | "down" | null =
              existing
                ? msg.rate > existing.rate
                  ? "up"
                  : msg.rate < existing.rate
                    ? "down"
                    : null
                : null;

            const next = new Map(prev);
            next.set(msg.valorBc, { ...msg, flash });

            // Clear flash after 600ms
            if (flash) {
              const existing = flashTimers.current.get(msg.valorBc);
              if (existing) clearTimeout(existing);
              flashTimers.current.set(
                msg.valorBc,
                setTimeout(() => {
                  setRates((r) => {
                    const m = new Map(r);
                    const entry = m.get(msg.valorBc);
                    if (entry) m.set(msg.valorBc, { ...entry, flash: null });
                    return m;
                  });
                }, 600)
              );
            }

            return next;
          });
        }
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      es.close();
      esRef.current = null;
      for (const t of flashTimers.current.values()) clearTimeout(t);
    };
  }, []);

  const rateList = Array.from(rates.values());

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-semibold text-sm">Live FX Rates</h3>
          {isStreaming ? (
            <span className="flex items-center gap-1 bg-green-900/40 text-green-400 text-xs px-2 py-0.5 rounded-full border border-green-800">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="flex items-center gap-1 bg-yellow-900/40 text-yellow-400 text-xs px-2 py-0.5 rounded-full border border-yellow-800">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              DELAYED
            </span>
          )}
        </div>
        <span className="text-gray-500 text-xs">SIX BFI Reference</span>
      </div>

      {/* Rate grid */}
      {rateList.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
          <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin mr-2" />
          Connecting to live feed…
        </div>
      ) : (
        <div className="space-y-1">
          {rateList.map((r) => {
            const spread = r.ask && r.bid ? (r.ask - r.bid).toFixed(4) : null;
            const flashClass =
              r.flash === "up"
                ? "bg-green-500/20"
                : r.flash === "down"
                  ? "bg-red-500/20"
                  : "";

            return (
              <div
                key={r.valorBc}
                className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors duration-300 ${flashClass || "hover:bg-gray-800/50"}`}
              >
                <span className="text-gray-300 text-xs font-mono w-20">
                  {r.pair}
                </span>
                <span
                  className={`font-mono text-sm font-semibold ${
                    r.flash === "up"
                      ? "text-green-400"
                      : r.flash === "down"
                        ? "text-red-400"
                        : "text-white"
                  }`}
                >
                  {r.rate.toFixed(4)}
                </span>
                <div className="flex items-center gap-3 text-xs">
                  {spread && (
                    <span className="text-gray-500">spd {spread}</span>
                  )}
                  <span
                    className={
                      r.change24h >= 0 ? "text-green-400" : "text-red-400"
                    }
                  >
                    {r.change24h >= 0 ? "+" : ""}
                    {r.change24h.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
