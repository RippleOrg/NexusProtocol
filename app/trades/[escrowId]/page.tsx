"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CollateralHealthPanel from "@/components/trades/CollateralHealthPanel";

interface CollateralInfo {
  collateralType: number;
  collateralMint: string;
  collateralAmount: number;
  sixBfiValorBc: string;
  collateralPriceUsd: number;
  collateralPriceUpdated: number;
  ltvBps: number;
  liquidationThresholdBps: number;
  isLiquidated: boolean;
  depositAmount: number;
}

interface EscrowDetail {
  escrowId: string;
  onChainPda: string;
  importer: string;
  exporter: string;
  importerInstitutionId: string;
  exporterInstitutionId: string;
  depositAmount: string;
  tokenMint: string;
  status: string;
  conditionsTotal: number;
  conditionsSatisfied: number;
  expiresAt: string;
  createdAt: string;
  fundedAt?: string;
  settledAt?: string;
  travelRuleAttached: boolean;
  collateral?: CollateralInfo;
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

const COLLATERAL_TYPE_BADGE: Record<number, string> = {
  1: "Gold-Backed",
  2: "Silver-Backed",
  3: "Platinum-Backed",
  4: "RWA-Backed",
};

interface PageProps {
  params: { escrowId: string };
}

export default function EscrowDetailPage({ params }: PageProps) {
  const { escrowId } = params;
  const [escrow, setEscrow] = useState<EscrowDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEscrow = async () => {
      try {
        // In production, fetch from API with escrowId
        const res = await fetch(`/api/escrows/${escrowId}`).catch(() => null);
        if (res?.ok) {
          const data = (await res.json()) as EscrowDetail;
          setEscrow(data);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchEscrow();
  }, [escrowId]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          Loading trade details…
        </div>
      </div>
    );
  }

  if (!escrow) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link
            href="/trades"
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            ← Back to Trades
          </Link>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-400">
            Trade not found or could not be loaded.
          </p>
          <p className="text-gray-600 text-xs mt-2 font-mono">{escrowId}</p>
        </div>
      </div>
    );
  }

  const hasCommodityCollateral =
    escrow.collateral && escrow.collateral.collateralType > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/trades"
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          ← Trades
        </Link>
        <span className="text-gray-600">/</span>
        <span className="text-gray-300 text-sm font-mono">
          {escrow.escrowId}
        </span>
      </div>

      {/* Title + badges */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Trade Detail</h1>
          <p className="text-gray-400 text-sm mt-1 font-mono">
            {escrow.onChainPda}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs px-3 py-1 rounded-full ${
              STATUS_COLORS[escrow.status] ?? STATUS_COLORS["Created"]
            }`}
          >
            {escrow.status}
          </span>
          {hasCommodityCollateral && escrow.collateral && (
            <span className="text-xs px-3 py-1 rounded-full bg-yellow-900/40 text-yellow-300 border border-yellow-800">
              🥇{" "}
              {COLLATERAL_TYPE_BADGE[escrow.collateral.collateralType] ??
                "Commodity-Backed"}
            </span>
          )}
          {escrow.travelRuleAttached && (
            <span className="text-xs px-3 py-1 rounded-full bg-blue-900/40 text-blue-300 border border-blue-800">
              Travel Rule ✓
            </span>
          )}
        </div>
      </div>

      {/* Collateral Health Panel */}
      {hasCommodityCollateral && escrow.collateral && (
        <CollateralHealthPanel
          collateral={escrow.collateral}
          escrowId={escrow.escrowId}
        />
      )}

      {/* Main details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <h3 className="text-white font-semibold text-sm">Parties</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Importer</span>
              <span className="text-gray-300">{escrow.importerInstitutionId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Exporter</span>
              <span className="text-gray-300">{escrow.exporterInstitutionId}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <h3 className="text-white font-semibold text-sm">Settlement</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Amount</span>
              <span className="text-white font-mono">
                {(Number(escrow.depositAmount) / 1_000_000).toLocaleString(
                  "en-US",
                  { style: "currency", currency: "USD" }
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Expires</span>
              <span className="text-gray-300">
                {new Date(escrow.expiresAt).toLocaleString()}
              </span>
            </div>
            {escrow.settledAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Settled</span>
                <span className="text-green-400">
                  {new Date(escrow.settledAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Conditions */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm">Conditions</h3>
            <span className="text-gray-400 text-xs">
              {escrow.conditionsSatisfied}/{escrow.conditionsTotal} satisfied
            </span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{
                width:
                  escrow.conditionsTotal > 0
                    ? `${(escrow.conditionsSatisfied / escrow.conditionsTotal) * 100}%`
                    : "0%",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
