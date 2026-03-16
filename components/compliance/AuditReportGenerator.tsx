"use client";

import { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ReportType =
  | "FULL"
  | "TRAVEL_RULE"
  | "SOURCE_OF_FUNDS"
  | "AML_HISTORY"
  | "LINEAGE_CHAIN";

interface ReportMeta {
  label: string;
  description: string;
}

const REPORT_TYPES: Record<ReportType, ReportMeta> = {
  FULL: {
    label: "Full Audit",
    description: "Complete record for general regulatory inspection",
  },
  SOURCE_OF_FUNDS: {
    label: "Source of Funds",
    description: "Prove fund origin chain — for AML inquiry",
  },
  TRAVEL_RULE: {
    label: "Travel Rule",
    description: "FATF compliance record — for cross-border inquiry",
  },
  AML_HISTORY: {
    label: "AML History",
    description: "Screening history — for sanctions investigation",
  },
  LINEAGE_CHAIN: {
    label: "Lineage Chain",
    description: "On-chain source-of-funds lineage records",
  },
};

interface GenerateRequest {
  institutionId: string;
  startDate: string;
  endDate: string;
  reportType: ReportType;
  regulatorName?: string;
  regulatorReference?: string;
  requestedBy?: string;
  includeSignature: boolean;
}

interface GeneratedReport {
  reportId: string;
  pdf: string; // base64
  hash: string;
  attestation: string | null;
  generatedAt: number;
  recordCount: number;
  machineReadable: Record<string, unknown>;
}

interface ArchivedReport {
  reportId: string;
  reportType: ReportType;
  institutionId: string;
  hash: string;
  generatedAt: number;
  recordCount: number;
}

const GENERATION_STEPS = [
  "Fetching escrow records",
  "Fetching Travel Rule logs",
  "Fetching AML screenings",
  "Fetching KYT events",
  "Fetching on-chain lineage",
  "Generating PDF",
  "Computing report hash",
  "Signing attestation",
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  defaultInstitutionId?: string;
}

export default function AuditReportGenerator({
  defaultInstitutionId = "",
}: Props) {
  // ── Form state ──────────────────────────────────────────────────────────────
  const [institutionId, setInstitutionId] = useState(defaultInstitutionId);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [reportType, setReportType] = useState<ReportType>("FULL");
  const [regulatorName, setRegulatorName] = useState("");
  const [regulatorReference, setRegulatorReference] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [includeSignature, setIncludeSignature] = useState(true);

  // ── Generation state ────────────────────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedReport | null>(null);

  // ── Archive ─────────────────────────────────────────────────────────────────
  const [archive, setArchive] = useState<ArchivedReport[]>([]);

  // ── Verify mode ─────────────────────────────────────────────────────────────
  const [verifyHash, setVerifyHash] = useState("");
  const [verifyAttestation, setVerifyAttestation] = useState("");
  const [verifyResult, setVerifyResult] = useState<
    "valid" | "invalid" | "error" | null
  >(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load archive from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("nexus_report_archive");
      if (raw) setArchive(JSON.parse(raw) as ArchivedReport[]);
    } catch {
      // ignore
    }
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function estimatePageCount(): number {
    // Rough estimate: cover + summary + 1 per section selected + appendix
    const sections =
      reportType === "FULL"
        ? 5
        : reportType === "LINEAGE_CHAIN"
          ? 2
          : 3;
    return sections + 2;
  }

  function simulateSteps(totalMs: number) {
    let step = 0;
    setCompletedSteps([]);
    setCurrentStep(0);
    intervalRef.current = setInterval(() => {
      setCompletedSteps((prev) => [...prev, step]);
      step += 1;
      if (step >= GENERATION_STEPS.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setCurrentStep(-1);
      } else {
        setCurrentStep(step);
      }
    }, totalMs / GENERATION_STEPS.length);
  }

  async function handleGenerate() {
    if (!institutionId) {
      setError("Institution ID is required");
      return;
    }
    setError(null);
    setResult(null);
    setGenerating(true);
    simulateSteps(3500);

    try {
      const payload: GenerateRequest = {
        institutionId,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        reportType,
        regulatorName: regulatorName || undefined,
        regulatorReference: regulatorReference || undefined,
        requestedBy: requestedBy || undefined,
        includeSignature,
      };

      const res = await fetch("/api/reports/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as Record<string, unknown>;

      if (!res.ok) {
        throw new Error((data.error as string) ?? "Report generation failed");
      }

      const generated: GeneratedReport = {
        reportId: data.reportId as string,
        pdf: data.pdf as string,
        hash: data.hash as string,
        attestation: (data.attestation as string | null) ?? null,
        generatedAt: data.generatedAt as number,
        recordCount: data.recordCount as number,
        machineReadable: data.machineReadable as Record<string, unknown>,
      };

      setResult(generated);

      // Add to archive
      const archived: ArchivedReport = {
        reportId: generated.reportId,
        reportType,
        institutionId,
        hash: generated.hash,
        generatedAt: generated.generatedAt,
        recordCount: generated.recordCount,
      };
      const updated = [archived, ...archive].slice(0, 20);
      setArchive(updated);
      try {
        localStorage.setItem("nexus_report_archive", JSON.stringify(updated));
      } catch {
        // ignore
      }
    } catch (err) {
      setError(String(err));
    } finally {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setCurrentStep(-1);
      setGenerating(false);
    }
  }

  function downloadPdf() {
    if (!result) return;
    const bytes = Uint8Array.from(atob(result.pdf), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus-report-${result.reportId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadJson() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result.machineReadable, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus-report-${result.reportId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleVerify() {
    if (!verifyHash || !verifyAttestation) {
      setVerifyResult("error");
      return;
    }
    try {
      const nacl = (await import("tweetnacl")).default;
      const bs58 = (await import("bs58")).default;
      const adminPubkeyStr =
        process.env.NEXT_PUBLIC_NEXUS_ADMIN_PUBKEY ?? null;
      if (!adminPubkeyStr) {
        setVerifyResult("error");
        return;
      }
      const pubkeyBytes = bs58.decode(adminPubkeyStr);
      const sigBytes = bs58.decode(verifyAttestation);
      const msgBytes = Buffer.from(verifyHash.replace(/^0x/, ""), "hex");
      const ok = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
      setVerifyResult(ok ? "valid" : "invalid");
    } catch {
      setVerifyResult("error");
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 text-sm text-gray-200">
      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-700 bg-gray-900/60 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white">
          Generate Regulatory Report
        </h2>

        {/* Institution + dates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 uppercase tracking-wide">
              Institution ID
            </label>
            <input
              className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
              placeholder="e.g. IMPORTER-BANK-001"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 uppercase tracking-wide">
              Start Date
            </label>
            <input
              type="date"
              className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 uppercase tracking-wide">
              End Date
            </label>
            <input
              type="date"
              className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {/* Report type selector */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-400 uppercase tracking-wide">
            Report Type
          </label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {(Object.keys(REPORT_TYPES) as ReportType[]).map((rt) => (
              <button
                key={rt}
                onClick={() => setReportType(rt)}
                title={REPORT_TYPES[rt].description}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  reportType === rt
                    ? "border-indigo-500 bg-indigo-900/40 text-indigo-300"
                    : "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500"
                }`}
              >
                <div className="font-semibold text-xs">
                  {REPORT_TYPES[rt].label}
                </div>
                <div className="text-gray-500 text-[10px] mt-0.5 leading-tight">
                  {REPORT_TYPES[rt].description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Regulator fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 uppercase tracking-wide">
              Regulator Name
            </label>
            <input
              className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={regulatorName}
              onChange={(e) => setRegulatorName(e.target.value)}
              placeholder="e.g. FINMA"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 uppercase tracking-wide">
              Reference Number
            </label>
            <input
              className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={regulatorReference}
              onChange={(e) => setRegulatorReference(e.target.value)}
              placeholder="Regulator case / request number"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 uppercase tracking-wide">
              Requested By
            </label>
            <input
              className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={requestedBy}
              onChange={(e) => setRequestedBy(e.target.value)}
              placeholder="Compliance officer name"
            />
          </div>
        </div>

        {/* Options row */}
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeSignature}
              onChange={(e) => setIncludeSignature(e.target.checked)}
              className="accent-indigo-500"
            />
            <span className="text-gray-300">
              Include cryptographic report signature
            </span>
          </label>
        </div>

        {/* Preview estimate */}
        <div className="rounded-lg bg-gray-800/60 border border-gray-700 px-4 py-2 text-xs text-gray-400">
          Estimated page count:{" "}
          <span className="text-gray-200 font-semibold">
            ~{estimatePageCount()} pages
          </span>
        </div>

        {error && (
          <div className="rounded-lg bg-red-950/50 border border-red-800 px-4 py-2 text-red-400 text-xs">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 transition-colors"
        >
          {generating ? "Generating…" : "Generate Report"}
        </button>
      </section>

      {/* ── Generation Progress ──────────────────────────────────────────── */}
      {generating && (
        <section className="rounded-xl border border-gray-700 bg-gray-900/60 p-6 space-y-3">
          <h3 className="text-base font-semibold text-white">
            Generating Report…
          </h3>
          <div className="space-y-2">
            {GENERATION_STEPS.map((step, i) => {
              const done = completedSteps.includes(i);
              const active = currentStep === i;
              return (
                <div
                  key={step}
                  className={`flex items-center gap-3 text-sm transition-opacity ${done ? "opacity-100" : active ? "opacity-100" : "opacity-40"}`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                      done
                        ? "bg-green-700 text-green-200"
                        : active
                          ? "bg-indigo-600 text-white animate-pulse"
                          : "bg-gray-700 text-gray-400"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span
                    className={
                      done
                        ? "text-green-400"
                        : active
                          ? "text-white"
                          : "text-gray-500"
                    }
                  >
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Result ───────────────────────────────────────────────────────── */}
      {result && !generating && (
        <section className="rounded-xl border border-green-800 bg-green-950/30 p-6 space-y-4">
          <div className="flex items-center gap-2 text-green-400 font-semibold text-base">
            <span>✓</span>
            <span>Report Generated</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-400">Report ID: </span>
              <span className="text-white font-mono">{result.reportId}</span>
            </div>
            <div>
              <span className="text-gray-400">Records: </span>
              <span className="text-white">{result.recordCount}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-400">SHA-256 Hash: </span>
              <span className="text-white font-mono break-all text-[10px]">
                {result.hash}
              </span>
            </div>
            {result.attestation && (
              <div className="col-span-2">
                <span className="text-gray-400">Attestation: </span>
                <span className="text-indigo-300 font-mono break-all text-[10px]">
                  {result.attestation}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={downloadPdf}
              className="rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white text-sm font-semibold px-4 py-2"
            >
              ↓ Download PDF
            </button>
            <button
              onClick={downloadJson}
              className="rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold px-4 py-2"
            >
              ↓ Download JSON
            </button>
          </div>
        </section>
      )}

      {/* ── Verify Report ────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-700 bg-gray-900/60 p-6 space-y-4">
        <h3 className="text-base font-semibold text-white">Verify Report</h3>
        <p className="text-xs text-gray-400">
          Paste the report hash and attestation from a generated report to
          cryptographically verify its authenticity using the NEXUS admin public
          key.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 uppercase tracking-wide">
              Report Hash (hex SHA-256)
            </label>
            <input
              className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={verifyHash}
              onChange={(e) => setVerifyHash(e.target.value)}
              placeholder="64-char hex…"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 uppercase tracking-wide">
              Attestation (base58)
            </label>
            <input
              className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={verifyAttestation}
              onChange={(e) => setVerifyAttestation(e.target.value)}
              placeholder="Base58-encoded Ed25519 signature…"
            />
          </div>
        </div>
        <button
          onClick={handleVerify}
          className="rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold px-4 py-2"
        >
          Verify Signature
        </button>
        {verifyResult === "valid" && (
          <div className="rounded-lg bg-green-950/50 border border-green-800 px-4 py-2 text-green-400 text-xs font-semibold">
            ✓ Valid — signature is authentic
          </div>
        )}
        {verifyResult === "invalid" && (
          <div className="rounded-lg bg-red-950/50 border border-red-800 px-4 py-2 text-red-400 text-xs font-semibold">
            ✗ Invalid — signature does not match
          </div>
        )}
        {verifyResult === "error" && (
          <div className="rounded-lg bg-yellow-950/50 border border-yellow-800 px-4 py-2 text-yellow-400 text-xs">
            Verification error — check inputs or configure NEXT_PUBLIC_NEXUS_ADMIN_PUBKEY
          </div>
        )}
      </section>

      {/* ── Archive ──────────────────────────────────────────────────────── */}
      {archive.length > 0 && (
        <section className="rounded-xl border border-gray-700 bg-gray-900/60 p-6 space-y-4">
          <h3 className="text-base font-semibold text-white">Report Archive</h3>
          <div className="space-y-2">
            {archive.map((rep) => (
              <div
                key={rep.reportId}
                className="flex items-center justify-between rounded-lg bg-gray-800/60 border border-gray-700 px-4 py-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div>
                    <span className="text-gray-400">ID: </span>
                    <span className="text-white font-mono">{rep.reportId}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Type: </span>
                    <span className="text-indigo-300">
                      {REPORT_TYPES[rep.reportType]?.label ?? rep.reportType}
                    </span>
                    <span className="text-gray-600 mx-1">·</span>
                    <span className="text-gray-400">Institution: </span>
                    <span className="text-gray-200">{rep.institutionId}</span>
                    <span className="text-gray-600 mx-1">·</span>
                    <span className="text-gray-400">Records: </span>
                    <span className="text-gray-200">{rep.recordCount}</span>
                  </div>
                  <div className="text-gray-500 text-[10px] font-mono break-all">
                    {rep.hash}
                  </div>
                </div>
                <div className="text-gray-500 ml-4 whitespace-nowrap">
                  {new Date(rep.generatedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
