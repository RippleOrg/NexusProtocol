"use client";

import { useEffect, useRef, useState } from "react";
import { DEMO_SCENARIOS, DemoScenario } from "@/lib/demo/demo-scenarios";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DemoStep {
  timeMs: number;
  label: string;
  annotation: string;
  status: "pending" | "active" | "done";
}

// Solana block finality ~400ms — used in the settlement complete banner.
// Note: `settlementDelayMs` in DemoScenario is the total demo playback duration,
// not the on-chain settlement time.
const SETTLEMENT_TIME_MS = 387;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emitProgress(pct: number) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("demo:progress", { detail: { progress: pct } })
    );
  }
}

function formatCurrency(amount: number, currency: string) {
  if (currency === "NGN") return `₦${(amount).toLocaleString()}`;
  if (currency === "KES") return `KSh ${(amount).toLocaleString()}`;
  return `$${(amount).toLocaleString()} ${currency}`;
}

function getSettlementOutput(scenario: DemoScenario) {
  const trade = scenario.trades[0];
  if (trade.settlementCurrency === "NGN") {
    // ~1,580 NGN per USD
    return formatCurrency(trade.amount * 1580, "NGN");
  }
  // ~128 KES per USD
  return formatCurrency(trade.amount * 128, "KES");
}

const JURISDICTION_FLAGS: Record<string, string> = {
  CH: "🇨🇭",
  NG: "🇳🇬",
  KE: "🇰🇪",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepRow({
  step,
  index,
}: {
  step: DemoStep;
  index: number;
}) {
  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-lg border transition-all duration-500 ${
        step.status === "active"
          ? "border-green-500 bg-green-950/30 shadow-lg shadow-green-900/20"
          : step.status === "done"
          ? "border-gray-700 bg-gray-900/30"
          : "border-gray-800 bg-transparent opacity-40"
      }`}
    >
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
          step.status === "done"
            ? "bg-green-600 text-white"
            : step.status === "active"
            ? "bg-green-500 text-black animate-pulse"
            : "bg-gray-800 text-gray-500"
        }`}
      >
        {step.status === "done" ? "✓" : index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-semibold ${
              step.status === "active"
                ? "text-green-400"
                : step.status === "done"
                ? "text-gray-200"
                : "text-gray-500"
            }`}
          >
            {step.label}
          </span>
          {step.status === "done" && (
            <span className="text-green-500 text-xs">✅</span>
          )}
          {step.status === "active" && (
            <span className="text-yellow-400 text-xs animate-pulse">
              ⚡ EXECUTING
            </span>
          )}
        </div>
        {(step.status === "active" || step.status === "done") && (
          <p className="text-xs text-gray-400 mt-1">{step.annotation}</p>
        )}
      </div>
    </div>
  );
}

function InstitutionCard({ scenario }: { scenario: DemoScenario }) {
  const importer = scenario.institutions.find((i) => i.role === "importer")!;
  const exporter = scenario.institutions.find((i) => i.role === "exporter")!;
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 p-3 rounded-lg bg-gray-800 border border-gray-700 text-center">
        <div className="text-lg mb-1">
          {JURISDICTION_FLAGS[importer.jurisdiction] ?? "🏦"}
        </div>
        <div className="text-xs font-bold text-gray-100 truncate">
          {importer.name}
        </div>
        <div className="text-xs text-gray-400">
          KYC Tier {importer.kycTier}{" "}
          {importer.fireblocksEnabled && (
            <span className="text-blue-400">· Fireblocks</span>
          )}
        </div>
      </div>
      <div className="text-gray-500 text-lg">→</div>
      <div className="flex-1 p-3 rounded-lg bg-gray-800 border border-gray-700 text-center">
        <div className="text-lg mb-1">
          {JURISDICTION_FLAGS[exporter.jurisdiction] ?? "🏦"}
        </div>
        <div className="text-xs font-bold text-gray-100 truncate">
          {exporter.name}
        </div>
        <div className="text-xs text-gray-400">KYC Tier {exporter.kycTier}</div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type DemoState = "selector" | "running" | "complete";

export default function DemoPage() {
  const [selectedId, setSelectedId] = useState<string>(DEMO_SCENARIOS[0].id);
  const [demoState, setDemoState] = useState<DemoState>("selector");
  const [steps, setSteps] = useState<DemoStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [autoPlay, setAutoPlay] = useState(true);
  const [settlementOutput, setSettlementOutput] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scenario = DEMO_SCENARIOS.find((s) => s.id === selectedId)!;

  // Build steps list whenever scenario changes
  useEffect(() => {
    const trade = scenario.trades[0];
    const conditionSteps: DemoStep[] = trade.conditions.map((c, i) => ({
      timeMs: 3000 + i * 3000,
      label: `Condition ${i + 1}: ${c.description}`,
      annotation:
        c.type === "DocumentHash"
          ? `Document hash submitted on-chain via Anchor instruction. SHA-256 verified against registry. ${c.releasePercent}% funds released.`
          : c.type === "OracleConfirm"
          ? `Switchboard oracle feed fires confirmation. On-chain CPI call validates oracle signature. ${c.releasePercent}% funds released.`
          : `Authorised signatory submits ed25519 signature. Programme verifies against KYC registry PDA. ${c.releasePercent}% funds released.`,
      status: "pending",
    }));

    const baseTime = conditionSteps.length * 3000 + 3000;

    const fixedSteps: DemoStep[] = [
      {
        timeMs: 0,
        label: "NEXUS vault initialised — escrow created on devnet",
        annotation: `${scenario.institutions[0].name} vault active. Escrow PDA derived from program seed. $${trade.amount.toLocaleString()} USDC locked.`,
        status: "pending",
      },
      ...conditionSteps,
      {
        timeMs: baseTime,
        label: "All conditions satisfied — dispute window open",
        annotation: `${trade.disputeWindowHours}-hour dispute window started. Counterparties may raise disputes via the programme. Demo mode: window skipped.`,
        status: "pending",
      },
      {
        timeMs: baseTime + 2000,
        label: "SIX BFI live FX rate loaded via WebSocket",
        annotation: `Real-time ${trade.depositCurrency}/${trade.settlementCurrency} rate streamed from SIX Group Web API (MTLS). Rate locked for atomic swap.`,
        status: "pending",
      },
      {
        timeMs: baseTime + 3000,
        label: "AML oracle clearance — both parties",
        annotation:
          "Chainalysis KYT screening on both wallet addresses. On-chain AML result PDA written. Risk score: LOW.",
        status: "pending",
      },
      {
        timeMs: baseTime + 4000,
        label: "Fireblocks MPC approval — pre-approved in demo",
        annotation:
          "Fireblocks TAP policy evaluated. MPC threshold signature constructed. Transaction broadcast to Solana.",
        status: "pending",
      },
      {
        timeMs: baseTime + 5000,
        label: "⚡ ATOMIC SETTLEMENT EXECUTING...",
        annotation: `Cross-border atomic swap. Programme executes settle_escrow instruction. Solana finality: ~400ms.`,
        status: "pending",
      },
    ];

    setSteps(fixedSteps);
    setCurrentStepIndex(-1);
    emitProgress(0);
  }, [scenario]);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function launchDemo() {
    setDemoState("running");
    setCurrentStepIndex(-1);
    setSettlementOutput("");

    const freshSteps: DemoStep[] = steps.map((s) => ({ ...s, status: "pending" }));
    setSteps(freshSteps);

    let idx = 0;
    function scheduleNext(stepsSnapshot: DemoStep[]) {
      if (idx >= stepsSnapshot.length) return;
      const step = stepsSnapshot[idx];
      const prevTime = idx === 0 ? 0 : stepsSnapshot[idx - 1].timeMs;
      const delay = step.timeMs - prevTime;

      timerRef.current = setTimeout(() => {
        const stepIdx = idx;
        setSteps((prev) => {
          const next: DemoStep[] = prev.map((s, i) => {
            if (i < stepIdx) return { ...s, status: "done" as const };
            if (i === stepIdx) return { ...s, status: "active" as const };
            return s;
          });
          return next;
        });
        setCurrentStepIndex(stepIdx);
        emitProgress(Math.round(((stepIdx + 1) / stepsSnapshot.length) * 95));

        idx++;
        if (idx < stepsSnapshot.length) {
          scheduleNext(stepsSnapshot);
        } else {
          // final step — mark done and complete demo
          timerRef.current = setTimeout(() => {
            setSteps((prev) => prev.map((s) => ({ ...s, status: "done" })));
            setCurrentStepIndex(stepsSnapshot.length);
            setSettlementOutput(getSettlementOutput(scenario));
            emitProgress(100);
            setDemoState("complete");

            // confetti
            import("canvas-confetti").then(({ default: confetti }) => {
              confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 },
              });
            });
          }, 500);
        }
      }, delay);
    }

    scheduleNext(freshSteps);
  }

  function resetDemo() {
    clearTimer();
    setDemoState("selector");
    setCurrentStepIndex(-1);
    setSettlementOutput("");
    emitProgress(0);
  }

  // Cleanup on unmount
  useEffect(() => () => clearTimer(), []);

  const trade = scenario.trades[0];

  // ── Selector screen ────────────────────────────────────────────────────────
  if (demoState === "selector") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-2xl space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-900/40 border border-green-700 text-green-400 text-xs font-medium mb-4">
              ⚡ NEXUS PROTOCOL — DEMO MODE
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tight">
              Live Settlement Demo
            </h1>
            <p className="text-gray-400 text-lg">
              Watch a cross-border trade settle atomically in under 400ms
            </p>
          </div>

          {/* Scenario cards */}
          <div className="grid gap-4">
            {DEMO_SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
                  selectedId === s.id
                    ? "border-green-500 bg-green-950/20"
                    : "border-gray-700 bg-gray-900 hover:border-gray-600"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-semibold text-white">{s.name}</div>
                    <div className="text-sm text-gray-400">{s.description}</div>
                  </div>
                  {selectedId === s.id && (
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-black text-xs font-bold">
                      ✓
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  {s.institutions.map((inst) => (
                    <span
                      key={inst.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-800 text-xs text-gray-300"
                    >
                      {JURISDICTION_FLAGS[inst.jurisdiction] ?? "🏦"}{" "}
                      {inst.name}
                    </span>
                  ))}
                  <span className="ml-auto text-xs text-green-400 font-medium">
                    ${s.trades[0].amount.toLocaleString()} {s.trades[0].depositCurrency}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Options */}
          <div className="flex items-center gap-3 px-1">
            <button
              onClick={() => setAutoPlay((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoPlay ? "bg-green-600" : "bg-gray-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoPlay ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-sm text-gray-300">
              Auto-play cinematic demo
            </span>
          </div>

          {/* Launch */}
          <button
            onClick={launchDemo}
            className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-lg transition-colors shadow-lg shadow-green-900/40"
          >
            🚀 Launch Demo
          </button>
        </div>
      </div>
    );
  }

  // ── Running / Complete screen ──────────────────────────────────────────────
  return (
    <div className="min-h-screen px-4 py-12 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel — steps */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">{scenario.name}</h2>
              <p className="text-sm text-gray-400">{scenario.description}</p>
            </div>
            {demoState === "running" && (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-900/40 border border-yellow-700 text-yellow-400 text-xs font-medium animate-pulse">
                ⚡ LIVE
              </span>
            )}
            {demoState === "complete" && (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-900/40 border border-green-700 text-green-400 text-xs font-medium">
                ✅ SETTLED
              </span>
            )}
          </div>

          <div className="space-y-2">
            {steps.map((step, i) => (
              <StepRow key={i} step={step} index={i} />
            ))}
          </div>

          {/* Settlement complete banner */}
          {demoState === "complete" && (
            <div className="mt-6 p-6 rounded-xl border-2 border-green-500 bg-green-950/30 space-y-4 animate-in fade-in duration-500">
              <div className="flex items-center gap-3">
                <span className="text-4xl">🎉</span>
                <div>
                  <div className="text-2xl font-bold text-green-400">
                    SETTLEMENT COMPLETE
                  </div>
                  <div className="text-gray-300">
                    ⚡ {SETTLEMENT_TIME_MS}ms — atomic cross-border settlement
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-gray-900 border border-gray-700">
                  <div className="text-xs text-gray-400 mb-1">Importer paid</div>
                  <div className="font-bold text-red-400">
                    −${trade.amount.toLocaleString()} {trade.depositCurrency}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-gray-900 border border-gray-700">
                  <div className="text-xs text-gray-400 mb-1">Exporter received</div>
                  <div className="font-bold text-green-400">+{settlementOutput}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                <span className="px-2 py-1 rounded bg-gray-800">
                  ✅ Travel Rule log written
                </span>
                <span className="px-2 py-1 rounded bg-gray-800">
                  ✅ Audit PDF available
                </span>
                <span className="px-2 py-1 rounded bg-gray-800">
                  ✅ AML cleared
                </span>
                <span className="px-2 py-1 rounded bg-gray-800">
                  ✅ Fireblocks MPC signed
                </span>
              </div>

              <div className="mt-2 p-3 rounded-lg bg-gray-900 border border-gray-700 text-center">
                <span className="text-gray-400 text-sm">
                  Compare:{" "}
                  <span className="line-through text-gray-500">
                    SWIFT wire — Wednesday
                  </span>{" "}
                  · NEXUS —{" "}
                  <span className="text-green-400 font-bold">
                    {SETTLEMENT_TIME_MS}ms
                  </span>
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={resetDemo}
                  className="flex-1 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-medium transition-colors"
                >
                  ← Back to Scenarios
                </button>
                <a
                  href="/trades/new"
                  className="flex-1 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-center transition-colors"
                >
                  Create Real Trade →
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Right panel — context */}
        <div className="space-y-4">
          {/* Institutions */}
          <div className="p-4 rounded-xl bg-gray-900 border border-gray-700 space-y-3">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              Counterparties
            </h3>
            <InstitutionCard scenario={scenario} />
          </div>

          {/* Trade details */}
          <div className="p-4 rounded-xl bg-gray-900 border border-gray-700 space-y-3">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              Trade
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Amount</span>
                <span className="text-white font-medium">
                  ${trade.amount.toLocaleString()} {trade.depositCurrency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Settlement</span>
                <span className="text-white">{trade.settlementCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Dispute window</span>
                <span className="text-white">{trade.disputeWindowHours}h</span>
              </div>
              <div className="pt-1 border-t border-gray-800 text-gray-400 text-xs leading-relaxed">
                {trade.description}
              </div>
            </div>
          </div>

          {/* Conditions */}
          <div className="p-4 rounded-xl bg-gray-900 border border-gray-700 space-y-3">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              Conditions
            </h3>
            <div className="space-y-2">
              {trade.conditions.map((c, i) => {
                const stepIdx = i + 1; // condition steps start at index 1 (after vault init)
                const condStep = steps[stepIdx];
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded transition-colors ${
                      condStep?.status === "done"
                        ? "text-green-400 bg-green-950/20"
                        : condStep?.status === "active"
                        ? "text-yellow-400 bg-yellow-950/20"
                        : "text-gray-500"
                    }`}
                  >
                    <span>
                      {condStep?.status === "done"
                        ? "✅"
                        : condStep?.status === "active"
                        ? "⚡"
                        : "○"}
                    </span>
                    <span className="flex-1">{c.description}</span>
                    <span className="text-gray-500">{c.releasePercent}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Travel Rule */}
          {trade.travelRuleData && (
            <div className="p-4 rounded-xl bg-gray-900 border border-gray-700 space-y-2">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                Travel Rule
              </h3>
              <div className="text-xs space-y-1 text-gray-400">
                <div>
                  <span className="text-gray-500">Originator: </span>
                  {trade.travelRuleData.originatorName}
                </div>
                <div>
                  <span className="text-gray-500">Beneficiary: </span>
                  {trade.travelRuleData.beneficiaryName}
                </div>
                <div className="font-mono text-gray-600 text-xs break-all">
                  {trade.travelRuleData.originatorAccount}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
