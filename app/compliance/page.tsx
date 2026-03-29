"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ComplianceEventFeed from "@/components/compliance/ComplianceEventFeed";
import { useAmlScreen } from "@/hooks/useCompliance";
import { useNexusSession } from "@/hooks/useNexusSession";
import { nexusFetch } from "@/lib/client/nexus-client";
import type { DashboardOverview } from "@/lib/nexus/types";

export default function CompliancePage() {
  const { authContext, institution } = useNexusSession();
  const [walletInput, setWalletInput] = useState("");
  const amlMutation = useAmlScreen();

  const overviewQuery = useQuery({
    queryKey: ["dashboard-overview", "compliance", institution?.id],
    queryFn: () =>
      nexusFetch<DashboardOverview>(
        "/api/dashboard/overview",
        { cache: "no-store" },
        authContext
      ),
    enabled: Boolean(institution),
    staleTime: 15_000,
  });

  const overview = overviewQuery.data;

  return (
    <div className="two-col">
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Wallet Screening</div>
            <span className="badge bb">CHAINALYSIS</span>
          </div>
          <div className="panel-body">
            <div className="form-group">
              <label className="form-label">Solana Wallet Address</label>
              <input
                value={walletInput}
                onChange={(event) => setWalletInput(event.target.value)}
                className="form-input"
                placeholder="Enter a wallet to screen"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                amlMutation.mutate({
                  wallet: walletInput.trim(),
                  institutionId: institution?.id ?? undefined,
                })
              }
              disabled={amlMutation.isPending || !walletInput.trim()}
              className="btn-primary"
              style={{ width: "100%" }}
            >
              {amlMutation.isPending ? "Screening..." : "Run AML check"}
            </button>

            {amlMutation.data?.result ? (
              <div className="verify-badge" style={{ marginTop: "14px" }}>
                <div className="verify-icon">✓</div>
                <div>
                  <div className="verify-text">
                    {amlMutation.data.result.recommendation} · score{" "}
                    {amlMutation.data.result.riskScore}
                  </div>
                  <div className="verify-sub">
                    {amlMutation.data.result.riskCategories.length
                      ? amlMutation.data.result.riskCategories.join(", ")
                      : "No risk categories returned"}
                  </div>
                </div>
              </div>
            ) : null}

            {amlMutation.error ? (
              <div className="warning-box" style={{ marginTop: "14px" }}>
                <div className="warning-box-text">
                  {amlMutation.error instanceof Error
                    ? amlMutation.error.message
                    : "Screening failed"}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <ComplianceEventFeed maxRows={16} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">KYC Registry</div>
          </div>
          <div className="panel-body">
            <div className="comp-list">
              <div className="comp-row">
                <span className="comp-row-label">
                  <strong>{institution?.name ?? "Current institution"}</strong>
                </span>
                <span className="badge bg">
                  Tier {institution?.kycTier ?? 0} · {institution?.jurisdiction ?? "N/A"}
                </span>
              </div>
              {overview?.latestEscrows.slice(0, 3).map((escrow) => (
                <div key={escrow.id} className="comp-row">
                  <span className="comp-row-label">
                    <strong>{escrow.exporterInstitutionName}</strong>
                  </span>
                  <span className="badge bg">{escrow.status.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Travel Rule Logs</div>
          </div>
          {overview?.latestEscrows.length ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Escrow</th>
                  <th>Amount</th>
                  <th>Counterparty</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {overview.latestEscrows.map((escrow) => (
                  <tr key={escrow.id}>
                    <td className="table-mono" style={{ color: "var(--accent)" }}>
                      {escrow.escrowId}
                    </td>
                    <td className="table-mono">
                      {(Number(escrow.depositAmount) / 1_000_000).toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td>{escrow.exporterInstitutionName}</td>
                    <td>
                      <span className={`badge ${escrow.travelRuleAttached ? "bg" : "ba"}`}>
                        {escrow.travelRuleAttached ? "ATTACHED" : "PENDING"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="panel-body">
              <div className="nexus-empty">
                <div className="nexus-empty-title">No logs yet</div>
                <div className="nexus-empty-copy">
                  Travel Rule records will appear once live trades are created.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">AML Archive</div>
          </div>
          <div className="panel-body">
            {overview?.latestAmlScreenings.length ? (
              <div className="comp-list">
                {overview.latestAmlScreenings.map((screening) => (
                  <div key={screening.id} className="comp-row">
                    <span className="comp-row-label">{screening.wallet}</span>
                    <span
                      className={`badge ${
                        screening.recommendation === "CLEAR" ? "bg" : "ba"
                      }`}
                    >
                      {screening.recommendation}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: "13px", lineHeight: "1.7", color: "var(--ink3)" }}>
                No AML screenings have been stored for this institution yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
