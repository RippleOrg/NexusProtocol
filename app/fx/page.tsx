"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFxRates } from "@/hooks/useFxVenue";
import {
  COLLATERAL_INSTRUMENTS,
  SUPPORTED_SETTLEMENT_INSTRUMENTS,
} from "@/lib/nexus/constants";

export default function FxPage() {
  const [selectedInstrument, setSelectedInstrument] = useState<
    (typeof SUPPORTED_SETTLEMENT_INSTRUMENTS)[number]["code"]
  >(SUPPORTED_SETTLEMENT_INSTRUMENTS[0].code);
  const ratesQuery = useFxRates();

  const currentInstrument = useMemo(
    () =>
      SUPPORTED_SETTLEMENT_INSTRUMENTS.find(
        (instrument) => instrument.code === selectedInstrument
      ) ?? SUPPORTED_SETTLEMENT_INSTRUMENTS[0],
    [selectedInstrument]
  );

  const selectedRate = useMemo(
    () =>
      ratesQuery.data?.find((rate) => rate.pair === currentInstrument.pair),
    [currentInstrument.pair, ratesQuery.data]
  );

  return (
    <div className="two-col">
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Reference Corridor</div>
          <select
            className="form-select"
            style={{ width: "auto", padding: "4px 10px", fontSize: "11px" }}
            value={selectedInstrument}
            onChange={(event) =>
              setSelectedInstrument(
                event.target.value as (typeof SUPPORTED_SETTLEMENT_INSTRUMENTS)[number]["code"]
              )
            }
          >
            {SUPPORTED_SETTLEMENT_INSTRUMENTS.map((instrument) => (
              <option key={instrument.code} value={instrument.code}>
                {instrument.pairLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="ob-mid">
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: "9px",
              color: "var(--ink4)",
              marginBottom: "2px",
            }}
          >
            {(selectedRate?.source === "FREE_FALLBACK"
              ? "SIX BFI"
              : "SIX BFI MID")}{" "}
            · {currentInstrument.valorBc}
          </div>
          <div className="ob-mid-rate">
            {selectedRate ? selectedRate.rate.toFixed(4) : "Unavailable"}
          </div>
          <div className="ob-mid-lbl">
            {(selectedRate?.change24h ?? 0) >= 0 ? "+" : ""}
            {selectedRate?.change24h.toFixed(2) ?? "0.00"}% · Corridor {currentInstrument.code}
          </div>
        </div>

        <div className="panel-body">
          <div className="detail-grid" style={{ marginBottom: "14px" }}>
            <div className="detail-box">
              <div className="detail-box-label">Bid</div>
              <div className="detail-box-val" style={{ color: "var(--green-600)" }}>
                {selectedRate?.bid.toFixed(4) ?? "--"}
              </div>
              <div className="detail-box-sub">Protected lower bound</div>
            </div>
            <div className="detail-box">
              <div className="detail-box-label">Ask</div>
              <div className="detail-box-val" style={{ color: "var(--red-600)" }}>
                {selectedRate?.ask.toFixed(4) ?? "--"}
              </div>
              <div className="detail-box-sub">Protected upper bound</div>
            </div>
            <div className="detail-box">
              <div className="detail-box-label">Spread</div>
              <div className="detail-box-val">
                {selectedRate ? (selectedRate.ask - selectedRate.bid).toFixed(4) : "--"}
              </div>
              <div className="detail-box-sub">Reference spread</div>
            </div>
            <div className="detail-box">
              <div className="detail-box-label">Pair</div>
              <div className="detail-box-val" style={{ color: "var(--accent)" }}>
                {currentInstrument.code}
              </div>
              <div className="detail-box-sub">{currentInstrument.pair}</div>
            </div>
          </div>

          <div className="route-card-list">
            {SUPPORTED_SETTLEMENT_INSTRUMENTS.map((instrument) => {
              const active = instrument.code === currentInstrument.code;
              const rate = ratesQuery.data?.find((item) => item.pair === instrument.pair);

              return (
                <button
                  key={instrument.code}
                  type="button"
                  onClick={() => setSelectedInstrument(instrument.code)}
                  className={`route-card ${active ? "is-selected" : ""}`}
                >
                  <div className="route-card-head">
                    <div>
                      <div className="route-card-title">{instrument.code}</div>
                      <div className="route-card-copy">{instrument.label}</div>
                    </div>
                    <span className={`badge ${active ? "bg" : "bs"}`}>
                      {rate && !rate.error ? rate.rate.toFixed(4) : "N/A"}
                    </span>
                  </div>
                  <div className="route-card-copy">
                    {instrument.pairLabel} · VALOR_BC {instrument.valorBc}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: "14px" }}>
            <Link
              href={`/trades/new?instrument=${currentInstrument.code}`}
              className="btn-primary"
            >
              Use this corridor in a new trade
            </Link>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Best Execution</div>
          </div>
          <div className="panel-body">
            <div className="comp-list">
              <div className="comp-row">
                <span className="comp-row-label">Reference mid</span>
                <span className="badge bg">
                  {selectedRate ? selectedRate.rate.toFixed(4) : "Pending"}
                </span>
              </div>
              <div className="comp-row">
                <span className="comp-row-label">Protected bid</span>
                <span className="badge bg">
                  {selectedRate ? selectedRate.bid.toFixed(4) : "Pending"}
                </span>
              </div>
              <div className="comp-row">
                <span className="comp-row-label">Protected ask</span>
                <span className="badge bg">
                  {selectedRate ? selectedRate.ask.toFixed(4) : "Pending"}
                </span>
              </div>
              <div className="comp-row">
                <span className="comp-row-label">Rate band guardrail</span>
                <span className="badge ba">APP ENFORCED</span>
              </div>
              <div className="comp-row">
                <span className="comp-row-label">Provider</span>
                <span className="badge bs">
                  {selectedRate?.provider === "CONVERTZ"
                    ? "CONVERTZ"
                    : selectedRate?.provider === "SIX_BFI_STREAM"
                      ? "SIX STREAM"
                      : selectedRate?.provider === "SIX_BFI_REST"
                        ? "SIX REST"
                        : "PENDING"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Collateral Rails</div>
          </div>
          <div className="panel-body">
            <div className="comp-list">
              {COLLATERAL_INSTRUMENTS.map((instrument) => (
                <div key={instrument.code} className="comp-row">
                  <span className="comp-row-label">{instrument.label}</span>
                  <span className="badge bs">{instrument.valorBc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Venue Notes</div>
          </div>
          <div className="panel-body">
            <div style={{ fontSize: "13px", lineHeight: "1.7", color: "var(--ink3)" }}>
              The FX workspace records the reference source shown here at trade
              creation time. SIX BFI remains the preferred source.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
