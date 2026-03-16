"use client";

import { useEffect, useState } from "react";

interface FxRate {
  pair: string;
  label: string;
  rate: number;
  bid: number;
  ask: number;
  change24h: number;
}

const PAIRS = [
  { value: "USDNGN", label: "USDC / NGNC" },
  { value: "EURUSD", label: "USDC / EURC" },
  { value: "USDKES", label: "USDC / KESC" },
  { value: "GBPUSD", label: "USDC / GBPC" },
];

export default function FxPage() {
  const [selectedPair, setSelectedPair] = useState("USDNGN");
  const [rates, setRates] = useState<FxRate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/rates");
        const data = (await res.json()) as { rates: FxRate[] };
        setRates(data.rates ?? []);
      } finally {
        setLoading(false);
      }
    };
    fetch_();
    const id = setInterval(fetch_, 10_000);
    return () => clearInterval(id);
  }, []);

  const selectedRate = rates.find((r) => r.pair === selectedPair);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">FX Venue</h1>
        <p className="text-gray-400 text-sm">
          Institutional RFQ orderbook and AMM liquidity
        </p>
      </div>

      {/* Pair selector */}
      <div className="flex gap-2 flex-wrap">
        {PAIRS.map((p) => (
          <button
            key={p.value}
            onClick={() => setSelectedPair(p.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedPair === p.value
                ? "bg-green-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Rate display */}
      {selectedRate && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-lg">
              {selectedRate.label ?? selectedRate.pair}
            </h2>
            <span className="text-gray-400 text-xs">SIX BFI Reference</span>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-gray-500 text-xs mb-1">Bid</p>
              <p className="text-red-400 font-mono text-2xl font-bold">
                {selectedRate.bid.toFixed(4)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-500 text-xs mb-1">Mid</p>
              <p className="text-white font-mono text-2xl font-bold">
                {selectedRate.rate.toFixed(4)}
              </p>
              <p
                className={`text-sm mt-1 ${
                  selectedRate.change24h >= 0
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {selectedRate.change24h >= 0 ? "+" : ""}
                {selectedRate.change24h.toFixed(2)}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-gray-500 text-xs mb-1">Ask</p>
              <p className="text-green-400 font-mono text-2xl font-bold">
                {selectedRate.ask.toFixed(4)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Orderbook Panel placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-3">Order Book</h3>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500 pb-2 border-b border-gray-800">
              <span>Rate</span>
              <span>Size</span>
              <span>Institution</span>
            </div>
            {/* Ask side */}
            {[1.3455, 1.3450, 1.3445].map((r) => (
              <div
                key={r}
                className="flex justify-between text-xs py-1 text-green-400"
              >
                <span className="font-mono">{r.toFixed(4)}</span>
                <span className="font-mono text-gray-300">
                  {(Math.random() * 100000).toFixed(0)}
                </span>
                <span className="text-gray-500">INST-XXX</span>
              </div>
            ))}
            <div className="border-t border-dashed border-gray-700 my-1" />
            {/* Bid side */}
            {[1.3440, 1.3435, 1.3430].map((r) => (
              <div
                key={r}
                className="flex justify-between text-xs py-1 text-red-400"
              >
                <span className="font-mono">{r.toFixed(4)}</span>
                <span className="font-mono text-gray-300">
                  {(Math.random() * 100000).toFixed(0)}
                </span>
                <span className="text-gray-500">INST-YYY</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-3">Post RFQ Quote</h3>
          <div className="space-y-3">
            <div>
              <label className="text-gray-400 text-xs">Rate</label>
              <input
                type="number"
                placeholder="1.3445"
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs">Amount (base)</label>
              <input
                type="number"
                placeholder="10000"
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs">Side</label>
              <select className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500">
                <option value="bid">Bid</option>
                <option value="ask">Ask</option>
              </select>
            </div>
            <button className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
              Post Quote (KYC Tier 3 Required)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
