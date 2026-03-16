"use client";

import { useState } from "react";
import ComplianceEventFeed from "@/components/compliance/ComplianceEventFeed";

export default function CompliancePage() {
  const [walletInput, setWalletInput] = useState("");
  const [amlResult, setAmlResult] = useState<{
    riskScore?: number;
    isSanctioned?: boolean;
    recommendation?: string;
    riskCategories?: string[];
    error?: string;
  } | null>(null);
  const [screening, setScreening] = useState(false);

  const runAmlScreen = async () => {
    if (!walletInput.trim()) return;
    setScreening(true);
    setAmlResult(null);
    try {
      const res = await fetch("/api/aml/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletInput.trim(), institutionId: "unknown" }),
      });
      const data = (await res.json()) as {
        result?: {
          riskScore: number;
          isSanctioned: boolean;
          recommendation: string;
          riskCategories: string[];
        };
        error?: string;
      };
      if (data.result) {
        setAmlResult(data.result);
      } else {
        setAmlResult({ error: data.error ?? "Screening failed" });
      }
    } catch (err) {
      setAmlResult({ error: String(err) });
    } finally {
      setScreening(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Compliance Center</h1>
        <p className="text-gray-400 text-sm">
          KYC/AML/KYT monitoring and Travel Rule management
        </p>
      </div>

      {/* AML Screener */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-white font-semibold mb-3">AML Wallet Screening</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Solana wallet address..."
            value={walletInput}
            onChange={(e) => setWalletInput(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
          />
          <button
            onClick={runAmlScreen}
            disabled={screening || !walletInput.trim()}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {screening ? "Screening..." : "Screen Wallet"}
          </button>
        </div>
        {amlResult && (
          <div className="mt-4 p-3 bg-gray-800 rounded-lg">
            {amlResult.error ? (
              <p className="text-red-400 text-sm">{amlResult.error}</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Recommendation</span>
                  <span
                    className={`text-sm font-semibold ${
                      amlResult.recommendation === "CLEAR"
                        ? "text-green-400"
                        : amlResult.recommendation === "REVIEW"
                        ? "text-yellow-400"
                        : "text-red-400"
                    }`}
                  >
                    {amlResult.recommendation}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Risk Score</span>
                  <span className="text-white font-mono">
                    {amlResult.riskScore} / 10
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Sanctioned</span>
                  <span
                    className={amlResult.isSanctioned ? "text-red-400" : "text-green-400"}
                  >
                    {amlResult.isSanctioned ? "YES ⚠️" : "No ✓"}
                  </span>
                </div>
                {amlResult.riskCategories && amlResult.riskCategories.length > 0 && (
                  <div>
                    <span className="text-gray-400 text-sm">Risk Categories</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {amlResult.riskCategories.map((c) => (
                        <span
                          key={c}
                          className="bg-red-900/50 text-red-400 text-xs px-2 py-0.5 rounded-full"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* KYC Management */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-white font-semibold mb-3">KYC Registry</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { tier: "Tier 1 — Basic", count: 0, color: "text-blue-400" },
            { tier: "Tier 2 — Enhanced", count: 0, color: "text-purple-400" },
            { tier: "Tier 3 — Institutional", count: 0, color: "text-green-400" },
          ].map((t) => (
            <div
              key={t.tier}
              className="bg-gray-800 rounded-lg p-3 text-center"
            >
              <div className={`text-2xl font-bold ${t.color}`}>{t.count}</div>
              <div className="text-gray-400 text-xs mt-1">{t.tier}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Real-time Compliance Event Feed (Solstream) */}
      <ComplianceEventFeed />
    </div>
  );
}
