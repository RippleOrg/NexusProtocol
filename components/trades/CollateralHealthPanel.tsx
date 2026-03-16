"use client";

import { useEffect, useRef, useState } from "react";

interface CollateralInfo {
  collateralType: number; // 0=Stablecoin,1=Gold,2=Silver,3=Platinum,4=Rwa
  collateralMint: string;
  collateralAmount: number;
  sixBfiValorBc: string;
  collateralPriceUsd: number; // scaled 1e8
  collateralPriceUpdated: number; // unix timestamp
  ltvBps: number;
  liquidationThresholdBps: number;
  isLiquidated: boolean;
  depositAmount: number; // trade USD amount
}

interface Props {
  collateral: CollateralInfo;
  escrowId: string;
}

const COLLATERAL_TYPE_LABELS: Record<number, string> = {
  0: "USDC",
  1: "Gold (XAU)",
  2: "Silver (XAG)",
  3: "Platinum (XPT)",
  4: "Commodity RWA",
};

const VALOR_BC_METAL_LABEL: Record<string, string> = {
  "274702_148": "XAU/USD",
  "274720_148": "XAG/USD",
  "287635_148": "XPT/USD",
};

export default function CollateralHealthPanel({ collateral, escrowId }: Props) {
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceTimestamp, setPriceTimestamp] = useState<number | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // Subscribe to SSE stream for live collateral price
  useEffect(() => {
    const es = new EventSource("/api/rates/stream");
    esRef.current = es;

    es.onopen = () => setStreamActive(true);
    es.onerror = () => setStreamActive(false);

    es.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as {
          type: string;
          valorBc?: string;
          rate?: number;
          timestamp?: number;
          streaming?: boolean;
          rates?: Array<{ valorBc: string; lastPrice: number; timestamp: number }>;
        };

        if (msg.type === "heartbeat") {
          setStreamActive(msg.streaming ?? false);
        } else if (
          msg.type === "rate_update" &&
          msg.valorBc === collateral.sixBfiValorBc
        ) {
          setCurrentPrice(msg.rate ?? null);
          setPriceTimestamp(msg.timestamp ?? null);
        } else if (msg.type === "snapshot" && msg.rates) {
          const found = msg.rates.find(
            (r) => r.valorBc === collateral.sixBfiValorBc
          );
          if (found) {
            setCurrentPrice(found.lastPrice);
            setPriceTimestamp(found.timestamp);
          }
        }
      } catch {
        // ignore
      }
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [collateral.sixBfiValorBc]);

  // Use stored price as fallback
  const priceUsd = currentPrice ?? collateral.collateralPriceUsd / 1e8;
  const lastUpdate = priceTimestamp ?? collateral.collateralPriceUpdated * 1000;

  // Current collateral USD value: amount (in raw units, 1e8 = 1 oz) * priceUsd per oz
  const collateralUsdValue = (collateral.collateralAmount / 1e8) * priceUsd;

  // Current LTV = deposit / collateral_value (in bps)
  const currentLtvBps =
    collateralUsdValue > 0
      ? Math.round((collateral.depositAmount / collateralUsdValue) * 10_000)
      : 10_000;

  const ltvPct = currentLtvBps / 100;
  const thresholdPct = collateral.liquidationThresholdBps / 100;
  const targetLtvPct = collateral.ltvBps / 100;

  const isHealthy = currentLtvBps < collateral.liquidationThresholdBps;
  const isWarning =
    currentLtvBps >= collateral.ltvBps * 1.0 &&
    currentLtvBps < collateral.liquidationThresholdBps;

  const gaugeWidth = Math.min((currentLtvBps / collateral.liquidationThresholdBps) * 100, 100);
  const gaugeColor = collateral.isLiquidated
    ? "bg-red-600"
    : !isHealthy
      ? "bg-red-500"
      : isWarning
        ? "bg-yellow-500"
        : "bg-green-500";

  const statusLabel = collateral.isLiquidated
    ? "LIQUIDATED"
    : !isHealthy
      ? "LIQUIDATION ZONE"
      : isWarning
        ? "WARNING"
        : "HEALTHY";

  const statusColor = collateral.isLiquidated
    ? "text-red-400 bg-red-900/30 border-red-800"
    : !isHealthy
      ? "text-red-400 bg-red-900/30 border-red-800"
      : isWarning
        ? "text-yellow-400 bg-yellow-900/30 border-yellow-800"
        : "text-green-400 bg-green-900/30 border-green-800";

  const metalLabel =
    VALOR_BC_METAL_LABEL[collateral.sixBfiValorBc] ??
    COLLATERAL_TYPE_LABELS[collateral.collateralType] ??
    "Commodity";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm">
            Collateral Health
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-300 border border-yellow-800">
            {COLLATERAL_TYPE_LABELS[collateral.collateralType] ?? "Commodity"}-Backed
          </span>
        </div>
        <div className="flex items-center gap-2">
          {streamActive && (
            <span className="flex items-center gap-1 text-green-400 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* LTV Gauge */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-400">
          <span>Current LTV</span>
          <span className="font-mono text-white">{ltvPct.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-3 relative overflow-hidden">
          {/* Target LTV marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-blue-400 opacity-60"
            style={{ left: `${(targetLtvPct / thresholdPct) * 100}%` }}
          />
          {/* Liquidation threshold marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500"
            style={{ left: "100%" }}
          />
          {/* Fill */}
          <div
            className={`h-3 rounded-full transition-all duration-700 ${gaugeColor}`}
            style={{ width: `${gaugeWidth}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>0%</span>
          <span className="text-blue-400">{targetLtvPct.toFixed(0)}% target</span>
          <span className="text-red-400">{thresholdPct.toFixed(0)}% liq.</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-gray-500 mb-1">Collateral Value</p>
          <p className="text-white font-mono font-semibold">
            ${collateralUsdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-gray-500 mt-0.5">
            {(collateral.collateralAmount / 1e8).toFixed(4)} oz @ ${priceUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-gray-500 mb-1">{metalLabel} Price</p>
          <p className="text-white font-mono font-semibold">
            ${priceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {lastUpdate && (
            <p className="text-gray-600 mt-0.5">
              {new Date(lastUpdate).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Warning: approaching threshold */}
      {isWarning && !collateral.isLiquidated && (
        <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 flex items-center justify-between">
          <div>
            <p className="text-yellow-300 text-xs font-medium">
              ⚠ Approaching liquidation threshold
            </p>
            <p className="text-yellow-500 text-xs mt-0.5">
              Add more collateral to reduce your LTV risk.
            </p>
          </div>
          <button
            type="button"
            className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ml-3"
          >
            Add Collateral
          </button>
        </div>
      )}

      {collateral.isLiquidated && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
          <p className="text-red-300 text-xs font-medium">
            ⚡ Collateral liquidated
          </p>
          <p className="text-red-500 text-xs mt-0.5">
            Escrow {escrowId} collateral was liquidated. Contact support for
            resolution.
          </p>
        </div>
      )}
    </div>
  );
}
