"use client";

import { useState } from "react";
import { useNexusSession } from "@/hooks/useNexusSession";
import { nexusFetch } from "@/lib/client/nexus-client";

type ReportType =
  | "FULL"
  | "TRAVEL_RULE"
  | "SOURCE_OF_FUNDS"
  | "AML_HISTORY"
  | "LINEAGE_CHAIN";

export default function ComplianceReportsPage() {
  const { authContext, institution } = useNexusSession();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportType, setReportType] = useState<ReportType>("FULL");
  const [regulatorName, setRegulatorName] = useState("");
  const [regulatorReference, setRegulatorReference] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [includeSignature, setIncludeSignature] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    pdfBase64?: string;
    hash?: string;
    fileSize?: number;
    reportId?: string;
  } | null>(null);

  const generateReport = async () => {
    if (!institution) {
      return;
    }

    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const payload = await nexusFetch<{
        pdfBase64?: string;
        hash?: string;
        fileSize?: number;
        reportId?: string;
      }>(
        "/api/reports/audit",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            institutionId: institution.id,
            startDate: new Date(startDate).toISOString(),
            endDate: new Date(endDate).toISOString(),
            reportType,
            regulatorName: regulatorName || undefined,
            regulatorReference: regulatorReference || undefined,
            requestedBy: requestedBy || undefined,
            includeSignature,
          }),
        },
        authContext
      );

      setResult(payload);
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : "Failed to generate report"
      );
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = () => {
    if (!result?.pdfBase64) {
      return;
    }

    const link = document.createElement("a");
    link.href = `data:application/pdf;base64,${result.pdfBase64}`;
    link.download = `nexus-${reportType.toLowerCase()}-${Date.now()}.pdf`;
    link.click();
  };

  return (
    <div className="two-col">
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Generate Regulatory Report</div>
        </div>
        <div className="panel-body">
          <div className="form-group">
            <label className="form-label">Institution</label>
            <input className="form-input readonly" disabled value={institution?.name ?? "Not loaded"} />
          </div>

          <div className="form-group">
            <label className="form-label">Report Type</label>
            <select
              className="form-select"
              value={reportType}
              onChange={(event) => setReportType(event.target.value as ReportType)}
            >
              <option value="FULL">Full Compliance Audit</option>
              <option value="SOURCE_OF_FUNDS">Source of Funds Chain</option>
              <option value="TRAVEL_RULE">Travel Rule Compliance</option>
              <option value="AML_HISTORY">AML Screening History</option>
              <option value="LINEAGE_CHAIN">Lineage Chain</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">From</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">To</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Regulator</label>
            <input
              className="form-input"
              value={regulatorName}
              onChange={(event) => setRegulatorName(event.target.value)}
              placeholder="FINMA, FCA, SEC..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Reference Number</label>
            <input
              className="form-input"
              value={regulatorReference}
              onChange={(event) => setRegulatorReference(event.target.value)}
              placeholder="Case, filing, or submission ID"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Requested By</label>
            <input
              className="form-input"
              value={requestedBy}
              onChange={(event) => setRequestedBy(event.target.value)}
              placeholder="Compliance lead or operator"
            />
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              background: "var(--stone-50)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--ink2)",
              marginBottom: "14px",
            }}
          >
            <input
              type="checkbox"
              checked={includeSignature}
              onChange={(event) => setIncludeSignature(event.target.checked)}
            />
            Include the admin signature block when a signing key is configured.
          </label>

          {error ? (
            <div className="warning-box">
              <div className="warning-box-text">{error}</div>
            </div>
          ) : null}

          <button
            type="button"
            className="btn-primary"
            style={{ width: "100%", padding: "10px" }}
            onClick={generateReport}
            disabled={!institution || !startDate || !endDate || generating}
          >
            {generating ? "Generating signed report..." : "Generate Signed Report"}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Report Preview</div>
          <span className={`badge ${result ? "bg" : "bs"}`}>
            {result ? "GENERATED" : "NOT GENERATED"}
          </span>
        </div>
        <div className="panel-body">
          {!result ? (
            <div className="report-preview">
              <div style={{ textAlign: "center", color: "var(--ink4)", padding: "50px 0", fontSize: "12px" }}>
                Generate a report to preview its hash, identifier, and download action here.
              </div>
            </div>
          ) : (
            <div className="summary-stack" style={{ gap: "12px" }}>
              <div className="report-preview">
                <div className="rh">Report</div>
                <div>
                  <span className="summary-key">Type:</span>{" "}
                  <span className="rv">{reportType}</span>
                </div>
                <div>
                  <span className="summary-key">Institution:</span>{" "}
                  <span className="rv">{institution?.name}</span>
                </div>
                <div>
                  <span className="summary-key">Report ID:</span>{" "}
                  <span className="rv">{result.reportId ?? "Pending"}</span>
                </div>
                <div className="rh">Artifact</div>
                <div>
                  <span className="summary-key">File size:</span>{" "}
                  <span className="rv">
                    {result.fileSize ? `${(result.fileSize / 1024).toFixed(1)} KB` : "Unavailable"}
                  </span>
                </div>
                <div>
                  <span className="summary-key">Signature:</span>{" "}
                  <span className="rs">{includeSignature ? "Requested" : "Skipped"}</span>
                </div>
              </div>

              <div className="subtle-panel">
                <div className="app-stat-label">SHA-256</div>
                <div className="hash-display">{result.hash ?? "Unavailable"}</div>
              </div>

              <button type="button" className="btn-outline" onClick={downloadPdf}>
                Download PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
