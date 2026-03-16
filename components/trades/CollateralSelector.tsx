"use client";

import { useEffect, useState } from "react";

interface MetalOption {
  label: string;
  valorBc: string;
  symbol: string;
  unit: string;
}

const METAL_OPTIONS: MetalOption[] = [
  { label: "Gold (XAU)", valorBc: "274702_148", symbol: "XAU", unit: "oz" },
  { label: "Silver (XAG)", valorBc: "274720_148", symbol: "XAG", unit: "oz" },
  { label: "Platinum (XPT)", valorBc: "287635_148", symbol: "XPT", unit: "oz" },
];

interface PriceData {
  rate: number;
  bid: number;
  ask: number;
  timestamp: number;
}

interface CollateralConfig {
  type: "stablecoin" | "commodity";
  metal?: MetalOption;
  price?: PriceData;
  ltvBps: number;
  collateralAmount: number;
  liquidationThresholdBps: number;
}

interface Props {
  tradeAmountUsd: number;
  onChange: (config: CollateralConfig) => void;
}

export default function CollateralSelector({ tradeAmountUsd, onChange }: Props) {
  const [mode, setMode] = useState<"stablecoin" | "commodity">("stablecoin");
  const [selectedMetal, setSelectedMetal] = useState<MetalOption>(METAL_OPTIONS[0]);
  const [ltvBps, setLtvBps] = useState(8000); // 80% default
  const [metalPrice, setMetalPrice] = useState<PriceData | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);

  const liquidationThresholdBps = Math.min(ltvBps + 500, 9500); // +5% above LTV

  // Fetch live metal price from rates API
  useEffect(() => {
    if (mode !== "commodity") return;

    const fetchPrice = async () => {
      setLoadingPrice(true);
      try {
        const res = await fetch("/api/rates");
        const data = (await res.json()) as {
          rates: Array<{
            pair: string;
            rate: number;
            bid: number;
            ask: number;
            timestamp: number;
          }>;
        };
        const metalPair =
          selectedMetal.symbol === "XAU"
            ? "XAUUSD"
            : selectedMetal.symbol === "XAG"
              ? "XAGUSD"
              : "XPTUSD";
        const found = data.rates?.find((r) => r.pair === metalPair);
        if (found) {
          setMetalPrice({
            rate: found.rate,
            bid: found.bid,
            ask: found.ask,
            timestamp: found.timestamp,
          });
        }
      } catch {
        // ignore
      } finally {
        setLoadingPrice(false);
      }
    };

    fetchPrice();
    const id = setInterval(fetchPrice, 15_000);
    return () => clearInterval(id);
  }, [mode, selectedMetal]);

  // Calculate required collateral
  const requiredCollateral =
    metalPrice && ltvBps > 0
      ? (tradeAmountUsd / metalPrice.rate) * (10_000 / ltvBps)
      : 0;

  // Notify parent of config changes
  useEffect(() => {
    const config: CollateralConfig = {
      type: mode,
      ltvBps,
      liquidationThresholdBps,
      collateralAmount: requiredCollateral,
      ...(mode === "commodity" && {
        metal: selectedMetal,
        price: metalPrice ?? undefined,
      }),
    };
    onChange(config);
    // onChange is intentionally excluded – callers should memoize it with useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedMetal, ltvBps, metalPrice, requiredCollateral, liquidationThresholdBps]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-gray-400 text-sm mb-2">Collateral Type</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("stablecoin")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors border ${
              mode === "stablecoin"
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Standard USDC
          </button>
          <button
            type="button"
            onClick={() => setMode("commodity")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors border ${
              mode === "commodity"
                ? "bg-yellow-600 border-yellow-500 text-white"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700"
            }`}
          >
            🥇 Tokenized Commodity
          </button>
        </div>
      </div>

      {mode === "commodity" && (
        <div className="space-y-4 bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          {/* Metal selector */}
          <div>
            <label className="text-gray-400 text-xs mb-1 block">
              Select Metal
            </label>
            <div className="flex gap-2">
              {METAL_OPTIONS.map((m) => (
                <button
                  key={m.valorBc}
                  type="button"
                  onClick={() => setSelectedMetal(m)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors border ${
                    selectedMetal.valorBc === m.valorBc
                      ? "bg-yellow-600 border-yellow-500 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live price */}
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            {loadingPrice ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                Fetching live price…
              </div>
            ) : metalPrice ? (
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">
                  {selectedMetal.label} (SIX BFI)
                </span>
                <div className="text-right">
                  <span className="text-white font-mono font-semibold">
                    ${metalPrice.rate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-gray-500 text-xs ml-1">/ {selectedMetal.unit}</span>
                </div>
              </div>
            ) : (
              <span className="text-gray-500 text-xs">Price unavailable</span>
            )}
          </div>

          {/* LTV slider */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-gray-400 text-xs">
                Loan-to-Value (LTV)
              </label>
              <span className="text-white text-xs font-mono">
                {(ltvBps / 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={5000}
              max={9000}
              step={100}
              value={ltvBps}
              onChange={(e) => setLtvBps(Number(e.target.value))}
              className="w-full accent-yellow-500"
            />
            <div className="flex justify-between text-gray-600 text-xs mt-0.5">
              <span>50%</span>
              <span>90%</span>
            </div>
          </div>

          {/* Required collateral info */}
          {metalPrice && tradeAmountUsd > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 text-xs space-y-1">
              <p className="text-yellow-300 font-medium">Collateral Required</p>
              <p className="text-gray-300">
                At current {selectedMetal.symbol} price of{" "}
                <span className="text-white font-mono">
                  ${metalPrice.rate.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
                , you need{" "}
                <span className="text-yellow-300 font-mono font-semibold">
                  {requiredCollateral.toFixed(4)} {selectedMetal.unit}
                </span>{" "}
                to secure a{" "}
                <span className="text-white font-mono">
                  ${tradeAmountUsd.toLocaleString("en-US")}
                </span>{" "}
                trade at {(ltvBps / 100).toFixed(0)}% LTV.
              </p>
              <p className="text-gray-400">
                Liquidation threshold:{" "}
                <span className="text-red-400">
                  {(liquidationThresholdBps / 100).toFixed(0)}% LTV
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
