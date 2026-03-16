"use client";

import { useState } from "react";

export default function ComplianceReportsPage() {
  const [institutionId, setInstitutionId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportType, setReportType] = useState<
    "FULL" | "ESCROW" | "TRAVEL_RULE" | "AML" | "KYT"
  >("FULL");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<{
    pdfBase64?: string;
    hash?: string;
    fileSize?: number;
    error?: string;
  } | null>(null);

  const generateReport = async () => {
    if (!institutionId || !startDate || !endDate) return;
    setGenerating(true);
    setProgress("Fetching on-chain data...");
    setResult(null);

    try {
      setTimeout(() => setProgress("Compiling Travel Rule logs..."), 500);
      setTimeout(() => setProgress("Building PDF..."), 1500);
      setTimeout(() => setProgress("Signing report..."), 2500);

      const res = await fetch("/api/reports/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionId,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          reportType,
        }),
      });

      const data = (await res.json()) as {
        pdfBase64?: string;
        hash?: string;
        fileSize?: number;
        error?: string;
      };
      setResult(data);
      setProgress(null);
    } catch (err) {
      setResult({ error: String(err) });
      setProgress(null);
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = () => {
    if (!result?.pdfBase64) return;
    const link = document.createElement("a");
    link.href = `data:application/pdf;base64,${result.pdfBase64}`;
    link.download = `nexus-audit-${institutionId}-${reportType}-${Date.now()}.pdf`;
    link.click();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Reports</h1>
        <p className="text-gray-400 text-sm">
          Generate compliance audit reports for regulatory submission
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-sm block mb-1">
              Institution ID
            </label>
            <input
              type="text"
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
              placeholder="INST-001"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm block mb-1">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) =>
                setReportType(
                  e.target.value as "FULL" | "ESCROW" | "TRAVEL_RULE" | "AML" | "KYT"
                )
              }
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
            >
              <option value="FULL">Full Compliance Report</option>
              <option value="ESCROW">Escrow Settlements</option>
              <option value="TRAVEL_RULE">Travel Rule Logs</option>
              <option value="AML">AML Screenings</option>
              <option value="KYT">KYT Events</option>
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-sm block mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm block mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
            />
          </div>
        </div>

        <button
          onClick={generateReport}
          disabled={generating || !institutionId || !startDate || !endDate}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {generating ? "Generating..." : "Generate Report"}
        </button>

        {progress && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            {progress}
          </div>
        )}

        {result && (
          <div className="bg-gray-800 rounded-lg p-4 space-y-3">
            {result.error ? (
              <p className="text-red-400 text-sm">{result.error}</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Report Ready</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {result.fileSize
                        ? `${(result.fileSize / 1024).toFixed(1)} KB`
                        : ""}
                    </p>
                    {result.hash && (
                      <p className="text-gray-500 text-xs font-mono mt-1 break-all">
                        SHA-256: {result.hash}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={downloadPdf}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Download PDF
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
