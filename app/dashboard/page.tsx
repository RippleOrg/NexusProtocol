"use client";

import { useEffect, useState } from "react";
import ComplianceEventFeed from "@/components/compliance/ComplianceEventFeed";

interface FxRate {
  pair: string;
  label: string;
  rate: number;
  bid: number;
  ask: number;
  change24h: number;
  error?: boolean;
}

interface StatData {
  totalTvl: string;
  activeTrades: number;
  volume30d: string;
  avgSettlementMs: number;
}

export default function DashboardPage() {
  const [fxRates, setFxRates] = useState<FxRate[]>([]);
  const [stats, setStats] = useState<StatData>({
    totalTvl: "$0",
    activeTrades: 0,
    volume30d: "$0",
    avgSettlementMs: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch("/api/rates");
        const data = (await res.json()) as { rates: FxRate[] };
        setFxRates(data.rates ?? []);
      } catch {
        // Rates unavailable
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
    const interval = setInterval(fetchRates, 10_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">NEXUS Protocol</h1>
          <p className="text-gray-400 text-sm">
            Compliance-native trade settlement & institutional FX
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-green-400 text-sm">Devnet Live</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total TVL",
            value: stats.totalTvl,
            icon: "💰",
            color: "text-green-400",
          },
          {
            label: "Active Trades",
            value: stats.activeTrades.toString(),
            icon: "📊",
            color: "text-blue-400",
          },
          {
            label: "30d Volume",
            value: stats.volume30d,
            icon: "📈",
            color: "text-purple-400",
          },
          {
            label: "Avg Settlement",
            value:
              stats.avgSettlementMs > 0
                ? `${stats.avgSettlementMs}ms`
                : "—",
            icon: "⚡",
            color: "text-yellow-400",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">{stat.label}</span>
              <span className="text-xl">{stat.icon}</span>
            </div>
            <div className={`text-2xl font-bold ${stat.color}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* FX Rates Ticker */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-white font-semibold mb-3">
          Live FX Rates{" "}
          <span className="text-gray-500 text-xs font-normal">
            (SIX BFI Reference)
          </span>
        </h2>
        {loading ? (
          <div className="flex gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-8 w-32 bg-gray-800 rounded animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {fxRates.map((rate) => (
              <div
                key={rate.pair}
                className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2"
              >
                <span className="text-gray-300 text-sm font-medium">
                  {rate.label ?? rate.pair}
                </span>
                <span className="text-white font-mono font-semibold">
                  {rate.error ? "—" : rate.rate.toFixed(4)}
                </span>
                {!rate.error && (
                  <span
                    className={`text-xs ${
                      rate.change24h >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {rate.change24h >= 0 ? "+" : ""}
                    {rate.change24h.toFixed(2)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Escrows Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Active Escrows</h2>
          <a
            href="/trades/new"
            className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
          >
            + New Trade
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left pb-2 font-medium">Escrow ID</th>
                <th className="text-left pb-2 font-medium">Parties</th>
                <th className="text-right pb-2 font-medium">Amount</th>
                <th className="text-left pb-2 font-medium">Currency</th>
                <th className="text-left pb-2 font-medium">Conditions</th>
                <th className="text-left pb-2 font-medium">Status</th>
                <th className="text-left pb-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={7}
                  className="text-center text-gray-500 py-8"
                >
                  No active escrows. Create your first trade to get started.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliance Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-white font-semibold mb-3">Compliance Status</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">KYC Status</span>
              <span className="bg-green-900/50 text-green-400 text-xs px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">AML Risk Score</span>
              <span className="text-white font-mono">0 / 10</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Travel Rule</span>
              <span className="bg-blue-900/50 text-blue-400 text-xs px-2 py-0.5 rounded-full">
                Compliant
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">KYT Alerts</span>
              <span className="text-gray-300">0</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-white font-semibold mb-3">Quick Actions</h2>
          <div className="space-y-2">
            <a
              href="/trades/new"
              className="block w-full bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-800 text-sm px-3 py-2 rounded-lg transition-colors text-center"
            >
              🚀 Create New Escrow
            </a>
            <a
              href="/fx"
              className="block w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-800 text-sm px-3 py-2 rounded-lg transition-colors text-center"
            >
              💱 FX Venue
            </a>
            <a
              href="/compliance"
              className="block w-full bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-800 text-sm px-3 py-2 rounded-lg transition-colors text-center"
            >
              🛡️ Compliance Center
            </a>
            <a
              href="/compliance/reports"
              className="block w-full bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-3 py-2 rounded-lg transition-colors text-center"
            >
              📄 Generate Audit Report
            </a>
          </div>
        </div>
      </div>

      {/* Live Compliance Event Feed */}
      <ComplianceEventFeed maxRows={20} />
    </div>
  );
}
