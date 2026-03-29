"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useEscrows } from "@/hooks/useEscrows";
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

export default function TradesPage() {
  const [search, setSearch] = useState("");
  const escrowsQuery = useEscrows();

  const rows = useMemo(() => {
    const allRows = escrowsQuery.data ?? [];
    if (!search.trim()) {
      return allRows;
    }

    const query = search.trim().toLowerCase();
    return allRows.filter((escrow) =>
      [
        escrow.escrowId,
        escrow.onChainPda,
        escrow.importerInstitutionName,
        escrow.exporterInstitutionName,
        escrow.status,
      ].some((field) => field.toLowerCase().includes(query))
    );
  }, [escrowsQuery.data, search]);

  const summary = useMemo(() => {
    const allRows = escrowsQuery.data ?? [];

    return {
      total: allRows.length,
      ready: allRows.filter((row) => row.status === "ConditionsSatisfied").length,
      disputes: allRows.filter((row) => row.status === "InDispute").length,
      attached: allRows.filter((row) => row.travelRuleAttached).length,
    };
  }, [escrowsQuery.data]);

  return (
    <div>
      {escrowsQuery.error ? (
        <div className="warning-box" style={{ marginBottom: "14px" }}>
          <div className="warning-box-text">
            {escrowsQuery.error instanceof Error
              ? escrowsQuery.error.message
              : "Failed to load live trade instructions"}
          </div>
        </div>
      ) : null}

      <div className="app-stats" style={{ marginBottom: "14px" }}>
        <div className="app-stat">
          <div className="app-stat-label">Instructions</div>
          <div className="app-stat-val">
            {escrowsQuery.isError ? "--" : summary.total}
          </div>
          <div className="app-stat-chg">Live devnet trade instructions</div>
        </div>
        <div className="app-stat">
          <div className="app-stat-label">Ready To Settle</div>
          <div className="app-stat-val" style={{ color: "var(--green-600)" }}>
            {escrowsQuery.isError ? "--" : summary.ready}
          </div>
          <div className="app-stat-chg">All required conditions satisfied</div>
        </div>
        <div className="app-stat">
          <div className="app-stat-label">Travel Rule Attached</div>
          <div className="app-stat-val">
            {escrowsQuery.isError ? "--" : summary.attached}
          </div>
          <div className="app-stat-chg">Instructions carrying disclosure data</div>
        </div>
        <div className="app-stat">
          <div className="app-stat-label">Disputes</div>
          <div className="app-stat-val" style={{ color: "var(--red-600)" }}>
            {escrowsQuery.isError ? "--" : summary.disputes}
          </div>
          <div className="app-stat-chg">Escrows requiring intervention</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Programmable Trade Instructions</div>
            <div style={{ fontSize: "12px", color: "var(--ink4)", marginTop: "4px" }}>
              Search by escrow ID, PDA, counterparty, or status.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <label style={{ position: "relative", minWidth: "280px" }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--ink4)",
                }}
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find by counterparty, status, or PDA"
                className="form-input"
                style={{ paddingLeft: "34px" }}
              />
            </label>

            <Link href="/trades/new" className="btn-primary" style={{ padding: "8px 14px" }}>
              Create Trade
            </Link>
          </div>
        </div>

        {escrowsQuery.isLoading ? (
          <div className="panel-body">
            <div className="nexus-empty">
              <div className="nexus-empty-title">Loading trade instructions</div>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="panel-body">
            <div className="nexus-empty">
              <div className="nexus-empty-title">No instructions found</div>
              <div className="nexus-empty-copy">
                {search
                  ? "Try another filter or clear the current search term."
                  : "Create a new trade to populate the settlement ledger."}
              </div>
            </div>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Instruction</th>
                <th>Importer</th>
                <th>Exporter</th>
                <th>Notional</th>
                <th>Asset</th>
                <th>Conditions</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((escrow) => {
                const status = getStatusBadge(escrow.status);
                return (
                  <tr key={escrow.id}>
                    <td>
                      <div className="table-mono" style={{ color: "var(--accent)" }}>
                        {escrow.escrowId}
                      </div>
                      <div
                        className="muted-mono"
                        style={{ fontSize: "9px", color: "var(--ink4)", marginTop: "4px" }}
                      >
                        {escrow.onChainPda.slice(0, 14)}...
                      </div>
                    </td>
                    <td>{escrow.importerInstitutionName}</td>
                    <td>{escrow.exporterInstitutionName}</td>
                    <td className="table-mono">{formatUsd(escrow.depositAmount)}</td>
                    <td className="table-mono">
                      {getSettlementInstrumentByMint(escrow.settlementMint)?.code ??
                        escrow.settlementMint}
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
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
