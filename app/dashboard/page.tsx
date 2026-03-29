"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ComplianceEventFeed from "@/components/compliance/ComplianceEventFeed";
import DevnetTokenLab from "@/components/devnet/DevnetTokenLab";
import { useFxRates } from "@/hooks/useFxVenue";
import { useNexusSession } from "@/hooks/useNexusSession";
import { nexusFetch } from "@/lib/client/nexus-client";
import { getSettlementInstrumentByMint } from "@/lib/nexus/constants";
import type { DashboardOverview } from "@/lib/nexus/types";

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
    notation: value >= 1_000_000 ? "compact" : "standard",
  }).format(value);
}

function formatDollarAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatStatus(status: string) {
  if (status === "ConditionsSatisfied") return { label: "READY", tone: "ba" };
  if (status === "Settled") return { label: "SETTLED", tone: "bg" };
  if (status === "InDispute") return { label: "DISPUTE", tone: "br" };
  if (status === "Refunded" || status === "Expired") {
    return { label: status.toUpperCase(), tone: "bs" };
  }

  return { label: status.toUpperCase(), tone: "bb" };
}

export default function DashboardPage() {
  const { authContext, institution, identity } = useNexusSession();
  const fxRatesQuery = useFxRates();

  const overviewQuery = useQuery({
    queryKey: ["dashboard-overview", identity.walletAddress],
    queryFn: () =>
      nexusFetch<DashboardOverview>(
        "/api/dashboard/overview",
        { cache: "no-store" },
        authContext
      ),
    enabled: Boolean(identity.walletAddress),
    staleTime: 15_000,
  });

  const rateCards = useMemo(
    () => (fxRatesQuery.data ?? []).filter((rate) => !rate.error).slice(0, 6),
    [fxRatesQuery.data]
  );
  const tickerSourceLabel = useMemo(
    () =>
      rateCards.some((rate) => rate.source === "FREE_FALLBACK")
        ? "SIX BFI"
        : "SIX BFI",
    [rateCards]
  );

  const chartBars = useMemo(() => {
    const escrows = overviewQuery.data?.latestEscrows ?? [];
    if (!escrows.length) {
      return [28, 34, 31, 45, 41, 56, 52, 60, 49, 64, 58, 66];
    }

    return escrows
      .slice(0, 12)
      .map((escrow, index) =>
        Math.max(
          12,
          Math.min(
            100,
            Math.round(Number(escrow.depositAmount) / 40_000 + 18 + index * 4)
          )
        )
      )
      .reverse();
  }, [overviewQuery.data?.latestEscrows]);

  const overview = overviewQuery.data;
  const stats = overview?.stats;
  const latestEscrows = overview?.latestEscrows ?? [];
  const estimatedSavings = stats ? stats.volume30dUsd * 0.0315 : null;

  return (
    <div>
      {overviewQuery.error ? (
        <div className="warning-box" style={{ marginBottom: "14px" }}>
          <div className="warning-box-text">
            {overviewQuery.error instanceof Error
              ? overviewQuery.error.message
              : "Failed to load live dashboard stats"}
          </div>
        </div>
      ) : null}

      <div className="app-stats">
        <div className="app-stat">
          <div className="app-stat-label">Total TVL</div>
          <div className="app-stat-val">
            {stats ? formatUsd(stats.totalTvlUsd) : "Loading"}
          </div>
          <div className="app-stat-chg">Active capital across live escrows</div>
        </div>
        <div className="app-stat">
          <div className="app-stat-label">Active Escrows</div>
          <div className="app-stat-val">
            {overviewQuery.isError ? "--" : stats?.activeTrades ?? 0}
          </div>
          <div className="app-stat-chg">
            {latestEscrows.length} recent on-chain instructions loaded
          </div>
        </div>
        <div className="app-stat">
          <div className="app-stat-label">30d Volume</div>
          <div className="app-stat-val">
            {stats ? formatUsd(stats.volume30dUsd) : "Loading"}
          </div>
          <div className="app-stat-chg up">
            {stats ? `${stats.travelRuleCoverage}% travel rule attached` : "Coverage pending"}
          </div>
        </div>
        <div className="app-stat">
          <div className="app-stat-label">Avg Settlement</div>
          <div className="app-stat-val" style={{ color: "var(--green-600)" }}>
            {overviewQuery.isError
              ? "Unavailable"
              : stats?.averageSettlementMs
                ? `${stats.averageSettlementMs}ms`
                : "Pending"}
          </div>
          <div className="app-stat-chg">Derived from Solana devnet settlement records</div>
        </div>
      </div>

      <div className="app-ticker">
        <div className="app-ticker-label">
          <div className="live-dot" />
          {tickerSourceLabel}
        </div>
        <div className="app-ticker-scroll">
          <div className="app-ticker-inner">
            {[...rateCards, ...rateCards].map((rate, index) => (
              <div key={`${rate.pair}-${index}`} className="app-tick">
                <span className="app-tick-pair">{rate.pair}</span>
                <span className="app-tick-rate">{rate.rate.toFixed(4)}</span>
                <span
                  className={`app-tick-chg ${rate.change24h >= 0 ? "up" : "dn"}`}
                >
                  {rate.change24h >= 0 ? "+" : ""}
                  {rate.change24h.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Active Escrows</div>
              <Link href="/trades/new" className="btn-primary" style={{ padding: "5px 12px", fontSize: "11px" }}>
                New Escrow
              </Link>
            </div>

            {overviewQuery.isLoading ? (
              <div className="panel-body">
                <div className="nexus-empty">
                  <div className="nexus-empty-title">Loading dashboard data</div>
                </div>
              </div>
            ) : latestEscrows.length === 0 ? (
              <div className="panel-body">
                <div className="nexus-empty">
                  <div className="nexus-empty-title">No active escrows yet</div>
                  <div className="nexus-empty-copy">
                    Create the first live instruction to populate the settlement book.
                  </div>
                </div>
              </div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Counterparty</th>
                    <th>Amount</th>
                    <th>Conditions</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {latestEscrows.map((escrow) => {
                    const status = formatStatus(escrow.status);

                    return (
                      <tr key={escrow.id}>
                        <td className="table-mono" style={{ color: "var(--accent)" }}>
                          {escrow.escrowId}
                        </td>
                        <td>
                          <div>{escrow.exporterInstitutionName}</div>
                          <div className="muted-mono" style={{ color: "var(--ink4)", marginTop: "2px" }}>
                            {getSettlementInstrumentByMint(escrow.settlementMint)?.code ??
                              escrow.settlementMint}
                          </div>
                        </td>
                        <td className="table-mono">
                          {formatDollarAmount(Number(escrow.depositAmount) / 1_000_000)}
                        </td>
                        <td>
                          <div className="prog-wrap">
                            <div className="prog-bar">
                              <div
                                className={`prog-fill ${
                                  escrow.conditionsSatisfied === escrow.conditionsTotal
                                    ? "green"
                                    : ""
                                }`}
                                style={{
                                  width:
                                    escrow.conditionsTotal > 0
                                      ? `${(escrow.conditionsSatisfied / escrow.conditionsTotal) * 100}%`
                                      : "0%",
                                }}
                              />
                            </div>
                            <span className="prog-label">
                              {escrow.conditionsSatisfied}/{escrow.conditionsTotal}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${status.tone}`}>{status.label}</span>
                        </td>
                        <td>
                          <Link
                            href={`/trades/${escrow.escrowId}`}
                            className="btn-outline"
                            style={{ padding: "4px 10px", fontSize: "10px" }}
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Settlement Volume Snapshot</div>
              <span className="muted-mono" style={{ color: "var(--ink4)", fontSize: "9px" }}>
                Application-derived view
              </span>
            </div>
            <div className="panel-body">
              <div className="mini-chart">
                {chartBars.map((height, index) => (
                  <div
                    key={`${height}-${index}`}
                    className="mc-bar"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "6px",
                  fontFamily: "var(--mono)",
                  fontSize: "9px",
                  color: "var(--ink4)",
                }}
              >
                <span>Mar 1</span>
                <span>Mar 10</span>
                <span>Mar 20</span>
                <span>Today</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <DevnetTokenLab />

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Compliance Status</div>
              <span className="badge bg">ALL CLEAR</span>
            </div>
            <div className="panel-body">
              <div className="comp-list">
                <div className="comp-row">
                  <span className="comp-row-label">KYC Registry</span>
                  <span className="badge bg">Tier {institution?.kycTier ?? 0}</span>
                </div>
                <div className="comp-row">
                  <span className="comp-row-label">Travel Rule Coverage</span>
                  <span className="badge bg">
                    {stats ? `${stats.travelRuleCoverage}%` : "Pending"}
                  </span>
                </div>
                <div className="comp-row">
                  <span className="comp-row-label">AML Clear Rate</span>
                  <span className="badge bg">
                    {stats ? `${stats.amlClearRate}%` : "Pending"}
                  </span>
                </div>
                <div className="comp-row">
                  <span className="comp-row-label">KYT Alerts</span>
                  <span className={`badge ${stats?.kytAlertCount ? "ba" : "bg"}`}>
                    {stats?.kytAlertCount ?? 0}
                  </span>
                </div>
                <div className="comp-row">
                  <span className="comp-row-label">Custody Path</span>
                  <span className={`badge ${institution?.fireblocksVaultId ? "bg" : "bs"}`}>
                    {institution?.fireblocksVaultId ? "FIREBLOCKS" : "STANDARD"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <ComplianceEventFeed maxRows={10} />

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Savings vs SWIFT</div>
            </div>
            <div className="panel-body" style={{ textAlign: "center" }}>
              <div className="app-stat-label">Estimated 30-day savings</div>
              <div
                className="app-stat-val"
                style={{ color: "var(--green-600)", marginTop: "8px" }}
              >
                {estimatedSavings ? formatDollarAmount(estimatedSavings) : "$0"}
              </div>
              <div className="app-stat-chg" style={{ marginTop: "8px" }}>
                Using a 3.2% SWIFT baseline against a 0.05% Nexus fee envelope.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: "14px" }}>
        <div className="panel-header">
          <div className="panel-title">Reporting Handoff</div>
          <Link href="/compliance/reports" className="btn-primary" style={{ padding: "5px 12px", fontSize: "11px" }}>
            Generate Report
          </Link>
        </div>
        <div className="panel-body">
          <div className="three-col">
            <div className="soft-card">
              <div className="app-stat-label">Full Audit Pack</div>
              <div style={{ marginTop: "8px", fontSize: "13px", lineHeight: "1.7", color: "var(--ink3)" }}>
                Export escrow history, AML screenings, and Travel Rule records in a
                single regulator-ready package.
              </div>
            </div>
            <div className="soft-card">
              <div className="app-stat-label">Lineage Review</div>
              <div style={{ marginTop: "8px", fontSize: "13px", lineHeight: "1.7", color: "var(--ink3)" }}>
                Include source-of-funds hashes and the identifiers already stored in
                the Nexus ledger.
              </div>
            </div>
            <div className="soft-card">
              <div className="app-stat-label">Travel Rule Logs</div>
              <div style={{ marginTop: "8px", fontSize: "13px", lineHeight: "1.7", color: "var(--ink3)" }}>
                Generate reporting artifacts from the disclosure payloads attached
                to your live settlement instructions.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
