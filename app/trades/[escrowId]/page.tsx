"use client";

import { use } from "react";
import Link from "next/link";
import { useEscrow } from "@/hooks/useEscrows";
import { getSettlementInstrumentByMint } from "@/lib/nexus/constants";

function formatUsd(value: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value) / 1_000_000);
}

function getStatusBadge(status: string) {
  if (status === "ConditionsSatisfied") return { label: "READY", tone: "ba" };
  if (status === "Settled") return { label: "SETTLED", tone: "bg" };
  if (status === "InDispute") return { label: "DISPUTE", tone: "br" };
  if (status === "Refunded" || status === "Expired") {
    return { label: status.toUpperCase(), tone: "bs" };
  }

  return { label: status.toUpperCase(), tone: "bb" };
}

export default function EscrowDetailPage({
  params,
}: {
  params: Promise<{ escrowId: string }>;
}) {
  const { escrowId } = use(params);
  const escrowQuery = useEscrow(escrowId);
  const escrow = escrowQuery.data;
  const settlementInstrument = escrow
    ? getSettlementInstrumentByMint(escrow.settlementMint)
    : null;

  if (escrowQuery.isLoading) {
    return (
      <div className="panel">
        <div className="panel-body">
          <div className="nexus-empty">
            <div className="nexus-empty-title">Loading settlement instruction</div>
          </div>
        </div>
      </div>
    );
  }

  if (!escrow) {
    return (
      <div className="panel">
        <div className="panel-body">
          <div className="nexus-empty">
            <div className="nexus-empty-title">Instruction not found</div>
            <div className="nexus-empty-copy">
              The requested trade could not be loaded from Solana devnet.
            </div>
            <div style={{ marginTop: "18px" }}>
              <Link href="/trades" className="btn-primary">
                Back to trades
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const status = getStatusBadge(escrow.status);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "14px",
          flexWrap: "wrap",
        }}
      >
        <Link href="/trades" className="btn-outline">
          Back to trades
        </Link>
        <span className={`badge ${status.tone}`}>{status.label}</span>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">{escrow.escrowId}</div>
          <div className="muted-mono" style={{ color: "var(--ink4)", fontSize: "9px" }}>
            PDA {escrow.onChainPda.slice(0, 18)}...
          </div>
        </div>
        <div className="panel-body">
          <div className="detail-grid">
            <div className="detail-box">
              <div className="detail-box-label">Escrow Amount</div>
              <div className="detail-box-val">{formatUsd(escrow.depositAmount)}</div>
              <div className="detail-box-sub">USDC deposit</div>
            </div>
            <div className="detail-box">
              <div className="detail-box-label">Settlement Asset</div>
              <div className="detail-box-val" style={{ color: "var(--accent)" }}>
                {settlementInstrument?.code ?? "N/A"}
              </div>
              <div className="detail-box-sub">
                {settlementInstrument?.label ?? escrow.settlementMint}
              </div>
            </div>
            <div className="detail-box">
              <div className="detail-box-label">FX Rate Reference</div>
              <div className="detail-box-val" style={{ color: "var(--green-600)" }}>
                {escrow.fxRate ? escrow.fxRate.toFixed(4) : "Pending"}
              </div>
              <div className="detail-box-sub">Stored with the instruction</div>
            </div>
            <div className="detail-box">
              <div className="detail-box-label">Travel Rule</div>
              <div className="detail-box-val" style={{ color: "var(--green-600)" }}>
                {escrow.travelRuleAttached ? "ATTACHED" : "PENDING"}
              </div>
              <div className="detail-box-sub">
                {escrow.travelRuleLogPda ? "Log recorded" : "Log not yet available"}
              </div>
            </div>
          </div>

          <div className="two-col">
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "9px",
                    color: "var(--ink4)",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    marginBottom: "10px",
                  }}
                >
                  Counterparty Pair
                </div>
                <div className="onboarding-grid-2">
                  <div className="soft-card">
                    <div className="app-stat-label">Importer</div>
                    <div style={{ marginTop: "8px", fontWeight: 600, color: "var(--ink)" }}>
                      {escrow.importerInstitutionName}
                    </div>
                    <div style={{ marginTop: "4px", fontSize: "11px", color: "var(--ink4)" }}>
                      {escrow.importerInstitutionId}
                    </div>
                  </div>
                  <div className="soft-card">
                    <div className="app-stat-label">Exporter</div>
                    <div style={{ marginTop: "8px", fontWeight: 600, color: "var(--ink)" }}>
                      {escrow.exporterInstitutionName}
                    </div>
                    <div style={{ marginTop: "4px", fontSize: "11px", color: "var(--ink4)" }}>
                      {escrow.exporterInstitutionId}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "9px",
                    color: "var(--ink4)",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    marginBottom: "10px",
                  }}
                >
                  Settlement Readiness
                </div>
                <div className="cond-list">
                  <div className="cond-row">
                    <div className={`cond-check ${escrow.travelRuleAttached ? "done" : ""}`}>
                      <svg viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="cond-name">Travel Rule record</div>
                      <div className="cond-type">DISCLOSURE PAYLOAD</div>
                    </div>
                    <span className="cond-pct">
                      {escrow.travelRuleAttached ? "DONE" : "PENDING"}
                    </span>
                  </div>
                  <div className="cond-row">
                    <div
                      className={`cond-check ${
                        escrow.conditionsSatisfied === escrow.conditionsTotal ? "done" : ""
                      }`}
                    >
                      <svg viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="cond-name">Instruction conditions</div>
                      <div className="cond-type">PROGRAMMABLE RELEASE LOGIC</div>
                    </div>
                    <span className="cond-pct">
                      {escrow.conditionsSatisfied}/{escrow.conditionsTotal}
                    </span>
                  </div>
                  <div className="cond-row">
                    <div className={`cond-check ${escrow.status === "Settled" ? "done" : ""}`}>
                      <svg viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="cond-name">Settlement status</div>
                      <div className="cond-type">WORKFLOW STATE</div>
                    </div>
                    <span className="cond-pct">{status.label}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">Recorded Identifiers</div>
                </div>
                <div className="panel-body">
                  <div className="summary-stack" style={{ gap: "10px" }}>
                    <div className="subtle-panel">
                      <div className="app-stat-label">Escrow PDA</div>
                      <div className="hash-display">{escrow.onChainPda}</div>
                    </div>
                    <div className="subtle-panel">
                      <div className="app-stat-label">Travel Rule Log</div>
                      <div className="hash-display">
                        {escrow.travelRuleLogPda ?? "Not attached"}
                      </div>
                    </div>
                    <div className="subtle-panel">
                      <div className="app-stat-label">Source of Funds Hash</div>
                      <div className="hash-display">
                        {escrow.sourceOfFundsHash ?? "Not stored"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">Timestamps</div>
                </div>
                <div className="panel-body">
                  <div className="summary-list">
                    <span className="summary-key">Created</span>
                    <span className="summary-value">
                      {new Date(escrow.createdAt).toLocaleString()}
                    </span>
                    <span className="summary-key">Expires</span>
                    <span className="summary-value">
                      {new Date(escrow.expiresAt).toLocaleString()}
                    </span>
                    <span className="summary-key">Settled</span>
                    <span className="summary-value">
                      {escrow.settledAt
                        ? new Date(escrow.settledAt).toLocaleString()
                        : "Pending"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">Operational Handoff</div>
                </div>
                <div className="panel-body">
                  <div style={{ fontSize: "13px", lineHeight: "1.7", color: "var(--ink3)" }}>
                    Use the FX workspace to monitor the corridor and continue the
                    settlement workflow once execution rails are ready.
                  </div>
                  <div style={{ marginTop: "14px" }}>
                    <Link href="/fx" className="btn-primary">
                      Open FX workspace
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
