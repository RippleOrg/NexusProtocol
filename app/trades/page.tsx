"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface EscrowRow {
  id: string;
  onChainPda: string;
  importerInstitutionId: string;
  exporterInstitutionId: string;
  depositAmount: string;
  tokenMint: string;
  status: string;
  conditionsTotal: number;
  conditionsSatisfied: number;
  expiresAt: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  Created: "bg-gray-800 text-gray-300",
  Funded: "bg-blue-900/50 text-blue-400",
  ConditionsPartial: "bg-yellow-900/50 text-yellow-400",
  ConditionsSatisfied: "bg-green-900/50 text-green-400",
  InDispute: "bg-red-900/50 text-red-400",
  Settled: "bg-emerald-900/50 text-emerald-400",
  Refunded: "bg-orange-900/50 text-orange-400",
  Expired: "bg-gray-800 text-gray-500",
};

export default function TradesPage() {
  const [escrows, setEscrows] = useState<EscrowRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEscrows = async () => {
      try {
        // In production, fetch from API
        setEscrows([]);
      } finally {
        setLoading(false);
      }
    };
    fetchEscrows();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Trade Escrows</h1>
          <p className="text-gray-400 text-sm">
            Manage your programmable trade settlements
          </p>
        </div>
        <Link
          href="/trades/new"
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + New Trade
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50">
              <tr className="text-gray-400">
                <th className="text-left p-4 font-medium">Escrow ID</th>
                <th className="text-left p-4 font-medium">Importer</th>
                <th className="text-left p-4 font-medium">Exporter</th>
                <th className="text-right p-4 font-medium">Amount</th>
                <th className="text-left p-4 font-medium">Conditions</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">Expires</th>
                <th className="text-left p-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                      Loading trades...
                    </div>
                  </td>
                </tr>
              ) : escrows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    No trades found.{" "}
                    <Link href="/trades/new" className="text-green-400 hover:underline">
                      Create your first trade
                    </Link>
                  </td>
                </tr>
              ) : (
                escrows.map((e) => (
                  <tr
                    key={e.id}
                    className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="p-4 font-mono text-xs text-gray-300">
                      {e.onChainPda.slice(0, 8)}…
                    </td>
                    <td className="p-4 text-gray-300">
                      {e.importerInstitutionId}
                    </td>
                    <td className="p-4 text-gray-300">
                      {e.exporterInstitutionId}
                    </td>
                    <td className="p-4 text-right text-white font-mono">
                      {(Number(e.depositAmount) / 1_000_000).toLocaleString(
                        "en-US",
                        { style: "currency", currency: "USD" }
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-700 rounded-full h-1.5 max-w-20">
                          <div
                            className="bg-green-500 h-1.5 rounded-full"
                            style={{
                              width:
                                e.conditionsTotal > 0
                                  ? `${(e.conditionsSatisfied / e.conditionsTotal) * 100}%`
                                  : "0%",
                            }}
                          />
                        </div>
                        <span className="text-gray-400 text-xs">
                          {e.conditionsSatisfied}/{e.conditionsTotal}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          STATUS_COLORS[e.status] ?? STATUS_COLORS["Created"]
                        }`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400 text-xs">
                      {new Date(e.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <Link
                        href={`/trades/${e.onChainPda}`}
                        className="text-green-400 hover:underline text-xs"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
