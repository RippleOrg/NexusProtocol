"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SETTLEMENT_CURRENCIES = [
  { value: "NGNC", label: "NGNC — Nigerian Naira Coin" },
  { value: "EURC", label: "EURC — Euro Coin" },
  { value: "KESC", label: "KESC — Kenyan Shilling Coin" },
  { value: "GBPC", label: "GBPC — British Pound Coin" },
];

const CONDITION_TYPES = [
  { value: "DocumentHash", label: "Document Hash Verification" },
  { value: "OracleConfirm", label: "Oracle Price Confirmation" },
  { value: "TimeBased", label: "Time-Based Release" },
  { value: "ManualApproval", label: "Manual Approval" },
  { value: "MultiSigApproval", label: "Multi-Signature Approval" },
];

export default function NewTradePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1
    exporterWallet: "",
    exporterInstitutionId: "",
    // Step 2
    depositAmount: "",
    settlementCurrency: "NGNC",
    fxRateBandBps: 100,
    expiresAt: "",
    // Step 3
    conditions: [
      {
        conditionType: "DocumentHash",
        description: "",
        documentHash: "",
        releaseBps: 10000,
      },
    ],
    // Step 4
    originatorName: "",
    originatorAccount: "",
    beneficiaryName: "",
    beneficiaryAccount: "",
    transactionReference: "",
    sourceOfFunds: "",
    // Step 5
    useFireblocks: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 5;

  const addCondition = () => {
    if (formData.conditions.length >= 10) return;
    setFormData((prev) => ({
      ...prev,
      conditions: [
        ...prev.conditions,
        {
          conditionType: "DocumentHash",
          description: "",
          documentHash: "",
          releaseBps: 0,
        },
      ],
    }));
  };

  const removeCondition = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  };

  const submitEscrow = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // In production, this would call the Anchor program
      await new Promise((resolve) => setTimeout(resolve, 2000));
      router.push("/trades");
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Create New Trade Escrow</h1>
        <p className="text-gray-400 text-sm">Step {step} of {totalSteps}</p>
      </div>

      {/* Step Progress */}
      <div className="flex gap-1 mb-8">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`flex-1 h-1 rounded-full ${
              i + 1 <= step ? "bg-green-500" : "bg-gray-700"
            }`}
          />
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        {/* Step 1: Counterparty */}
        {step === 1 && (
          <>
            <h2 className="text-white font-semibold">Counterparty Details</h2>
            <div>
              <label className="text-gray-400 text-sm block mb-1">
                Exporter Wallet Address
              </label>
              <input
                type="text"
                value={formData.exporterWallet}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, exporterWallet: e.target.value }))
                }
                placeholder="Solana wallet address (base58)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1">
                Exporter Institution ID
              </label>
              <input
                type="text"
                value={formData.exporterInstitutionId}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    exporterInstitutionId: e.target.value,
                  }))
                }
                placeholder="e.g. FIRST-BANK-NG"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>
          </>
        )}

        {/* Step 2: Amount & FX */}
        {step === 2 && (
          <>
            <h2 className="text-white font-semibold">Amount & FX Parameters</h2>
            <div>
              <label className="text-gray-400 text-sm block mb-1">
                Deposit Amount (USDC)
              </label>
              <input
                type="number"
                value={formData.depositAmount}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, depositAmount: e.target.value }))
                }
                placeholder="10000"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1">
                Settlement Currency
              </label>
              <select
                value={formData.settlementCurrency}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    settlementCurrency: e.target.value,
                  }))
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              >
                {SETTLEMENT_CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1">
                FX Rate Band: ±{formData.fxRateBandBps} bps
              </label>
              <input
                type="range"
                min="25"
                max="500"
                step="25"
                value={formData.fxRateBandBps}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    fxRateBandBps: Number(e.target.value),
                  }))
                }
                className="w-full accent-green-500"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1">
                Expiry Date
              </label>
              <input
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, expiresAt: e.target.value }))
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>
          </>
        )}

        {/* Step 3: Conditions */}
        {step === 3 && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold">Trade Conditions</h2>
              <button
                onClick={addCondition}
                disabled={formData.conditions.length >= 10}
                className="text-green-400 hover:text-green-300 text-sm disabled:opacity-50"
              >
                + Add Condition
              </button>
            </div>
            {formData.conditions.map((cond, i) => (
              <div
                key={i}
                className="bg-gray-800 rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm font-medium">
                    Condition {i + 1}
                  </span>
                  {formData.conditions.length > 1 && (
                    <button
                      onClick={() => removeCondition(i)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <select
                  value={cond.conditionType}
                  onChange={(e) => {
                    const updated = [...formData.conditions];
                    updated[i] = { ...updated[i], conditionType: e.target.value };
                    setFormData((p) => ({ ...p, conditions: updated }));
                  }}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none"
                >
                  {CONDITION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Description"
                  value={cond.description}
                  onChange={(e) => {
                    const updated = [...formData.conditions];
                    updated[i] = { ...updated[i], description: e.target.value };
                    setFormData((p) => ({ ...p, conditions: updated }));
                  }}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none"
                />
                {cond.conditionType === "DocumentHash" && (
                  <input
                    type="text"
                    placeholder="Document hash (SHA-256 hex)"
                    value={cond.documentHash}
                    onChange={(e) => {
                      const updated = [...formData.conditions];
                      updated[i] = { ...updated[i], documentHash: e.target.value };
                      setFormData((p) => ({ ...p, conditions: updated }));
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-xs font-mono focus:outline-none"
                  />
                )}
                <div>
                  <label className="text-gray-500 text-xs">
                    Release BPS: {cond.releaseBps} ({(cond.releaseBps / 100).toFixed(0)}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10000"
                    step="100"
                    value={cond.releaseBps}
                    onChange={(e) => {
                      const updated = [...formData.conditions];
                      updated[i] = { ...updated[i], releaseBps: Number(e.target.value) };
                      setFormData((p) => ({ ...p, conditions: updated }));
                    }}
                    className="w-full accent-green-500"
                  />
                </div>
              </div>
            ))}
          </>
        )}

        {/* Step 4: Travel Rule & Compliance */}
        {step === 4 && (
          <>
            <h2 className="text-white font-semibold">Travel Rule & Compliance</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-xs block mb-1">
                  Originator Name
                </label>
                <input
                  type="text"
                  value={formData.originatorName}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, originatorName: e.target.value }))
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">
                  Originator Account
                </label>
                <input
                  type="text"
                  value={formData.originatorAccount}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      originatorAccount: e.target.value,
                    }))
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">
                  Beneficiary Name
                </label>
                <input
                  type="text"
                  value={formData.beneficiaryName}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, beneficiaryName: e.target.value }))
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">
                  Beneficiary Account
                </label>
                <input
                  type="text"
                  value={formData.beneficiaryAccount}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      beneficiaryAccount: e.target.value,
                    }))
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-green-500"
                />
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">
                Transaction Reference
              </label>
              <input
                type="text"
                value={formData.transactionReference}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    transactionReference: e.target.value,
                  }))
                }
                placeholder="PO-2024-001 / LC-12345"
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">
                Source of Funds Declaration
              </label>
              <textarea
                value={formData.sourceOfFunds}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, sourceOfFunds: e.target.value }))
                }
                rows={2}
                placeholder="e.g. Export proceeds from manufactured goods"
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-green-500 resize-none"
              />
            </div>
          </>
        )}

        {/* Step 5: Summary & Submit */}
        {step === 5 && (
          <>
            <h2 className="text-white font-semibold">Review & Submit</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Exporter</span>
                <span className="text-white font-mono text-xs">
                  {formData.exporterWallet.slice(0, 16)}...
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Amount</span>
                <span className="text-white">
                  {formData.depositAmount} USDC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Settlement Currency</span>
                <span className="text-white">{formData.settlementCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">FX Rate Band</span>
                <span className="text-white">±{formData.fxRateBandBps} bps</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Conditions</span>
                <span className="text-white">
                  {formData.conditions.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Travel Rule</span>
                <span
                  className={
                    Number(formData.depositAmount) >= 1000
                      ? "text-green-400"
                      : "text-gray-400"
                  }
                >
                  {Number(formData.depositAmount) >= 1000
                    ? "Required ✓"
                    : "Not required"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="useFireblocks"
                checked={formData.useFireblocks}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    useFireblocks: e.target.checked,
                  }))
                }
                className="accent-green-500"
              />
              <label htmlFor="useFireblocks" className="text-gray-300 text-sm">
                Use Fireblocks MPC signing
              </label>
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}
          </>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t border-gray-800">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="px-4 py-2 text-gray-400 hover:text-white disabled:opacity-0 text-sm"
          >
            ← Back
          </button>
          {step < totalSteps ? (
            <button
              onClick={() => setStep((s) => Math.min(totalSteps, s + 1))}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={submitEscrow}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {submitting ? "Creating Escrow..." : "Create Escrow"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
