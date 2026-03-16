"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type EntityType = "Bank" | "Licensed Fintech" | "Broker-Dealer" | "Commodity Trader";
type TravelRuleProtocol = "TRISA" | "OpenVASP" | "SYGNA";
type WalletOption = "phantom" | "fireblocks";

interface InstitutionProfile {
  name: string;
  jurisdiction: string;
  entityType: EntityType;
  licenseNumber: string;
  regulatorName: string;
}

interface KycDocument {
  name: string;
  file: File | null;
  sha256: string;
  status: "idle" | "hashing" | "done" | "error";
}

interface WalletSetup {
  option: WalletOption;
  solanaAddress: string;
  fireblocksVaultId: string;
  fireblocksWebhookUrl: string;
}

interface TravelRuleConfig {
  vaspId: string;
  vaspName: string;
  jurisdiction: string;
  protocol: TravelRuleProtocol;
  counterpartySearch: string;
  testStatus: "idle" | "sending" | "success" | "error";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const JURISDICTIONS = [
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "AE", name: "UAE", flag: "🇦🇪" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿" },
];

const ENTITY_TYPES: EntityType[] = [
  "Bank",
  "Licensed Fintech",
  "Broker-Dealer",
  "Commodity Trader",
];

const REQUIRED_DOCS = [
  "Certificate of Incorporation",
  "Regulatory License",
  "Authorised Signatory List",
];

const TRAVEL_RULE_PROTOCOLS: TravelRuleProtocol[] = [
  "TRISA",
  "OpenVASP",
  "SYGNA",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function deriveKycPda(institutionId: string): string {
  // Client-side approximation — real PDA derived on-chain
  const encoded = btoa(
    `kyc-record-${institutionId}-${Date.now()}`
  ).replace(/=/g, "");
  return encoded.slice(0, 44);
}

// ─── Step Components ──────────────────────────────────────────────────────────

function StepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  const STEP_LABELS = [
    "Institution Profile",
    "KYC Documents",
    "Wallet & Custody",
    "Travel Rule",
  ];

  return (
    <div className="flex items-center gap-2 mb-8">
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="flex items-center gap-2 flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i < currentStep
                  ? "bg-green-600 text-white"
                  : i === currentStep
                  ? "bg-green-500 text-black"
                  : "bg-gray-800 text-gray-500 border border-gray-700"
              }`}
            >
              {i < currentStep ? "✓" : i + 1}
            </div>
            <span
              className={`text-xs hidden md:block ${
                i === currentStep ? "text-green-400 font-medium" : "text-gray-500"
              }`}
            >
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div
              className={`flex-1 h-0.5 mb-4 transition-colors ${
                i < currentStep ? "bg-green-600" : "bg-gray-800"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Institution Profile ──────────────────────────────────────────────

function Step1Profile({
  profile,
  onChange,
}: {
  profile: InstitutionProfile;
  onChange: (p: InstitutionProfile) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Institution Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={profile.name}
          onChange={(e) => onChange({ ...profile, name: e.target.value })}
          placeholder="e.g. AMINA Bank AG"
          className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Jurisdiction <span className="text-red-400">*</span>
        </label>
        <select
          value={profile.jurisdiction}
          onChange={(e) => onChange({ ...profile, jurisdiction: e.target.value })}
          className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-green-500 transition-colors"
        >
          <option value="">— Select jurisdiction —</option>
          {JURISDICTIONS.map((j) => (
            <option key={j.code} value={j.code}>
              {j.flag} {j.name} ({j.code})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Entity Type <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {ENTITY_TYPES.map((et) => (
            <button
              key={et}
              type="button"
              onClick={() => onChange({ ...profile, entityType: et })}
              className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                profile.entityType === et
                  ? "border-green-500 bg-green-950/30 text-green-400"
                  : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
              }`}
            >
              {et}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Regulatory License Number <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={profile.licenseNumber}
          onChange={(e) =>
            onChange({ ...profile, licenseNumber: e.target.value })
          }
          placeholder="e.g. FINMA-2024-0012"
          className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Regulator Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={profile.regulatorName}
          onChange={(e) =>
            onChange({ ...profile, regulatorName: e.target.value })
          }
          placeholder="e.g. FINMA (Switzerland) / CBN (Nigeria)"
          className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
        />
      </div>
    </div>
  );
}

// ─── Step 2: KYC Documents ────────────────────────────────────────────────────

function Step2KycDocs({
  docs,
  onChange,
}: {
  docs: KycDocument[];
  onChange: (docs: KycDocument[]) => void;
}) {
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  async function handleFile(index: number, file: File | null) {
    if (!file) return;
    const updated = docs.map((d, i) =>
      i === index ? { ...d, file, status: "hashing" as const } : d
    );
    onChange(updated);

    try {
      const hash = await sha256Hex(file);
      onChange(
        updated.map((d, i) =>
          i === index ? { ...d, sha256: hash, status: "done" as const } : d
        )
      );
    } catch {
      onChange(
        updated.map((d, i) =>
          i === index ? { ...d, status: "error" as const } : d
        )
      );
    }
  }

  return (
    <div className="space-y-5">
      <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-800 text-blue-300 text-sm">
        📋 File hash computed client-side (SHA-256) and stored on-chain.{" "}
        <span className="text-gray-400">
          Document verification typically takes 1 business day.{" "}
          <span className="text-green-400 font-medium">
            In demo mode: instant.
          </span>
        </span>
      </div>

      {docs.map((doc, i) => (
        <div
          key={doc.name}
          className="p-4 rounded-lg bg-gray-800 border border-gray-700 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-200">{doc.name}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                doc.status === "done"
                  ? "bg-green-900/40 text-green-400"
                  : doc.status === "hashing"
                  ? "bg-yellow-900/40 text-yellow-400"
                  : doc.status === "error"
                  ? "bg-red-900/40 text-red-400"
                  : "bg-gray-700 text-gray-400"
              }`}
            >
              {doc.status === "done"
                ? "✅ Verified"
                : doc.status === "hashing"
                ? "⟳ Hashing..."
                : doc.status === "error"
                ? "❌ Error"
                : "Pending"}
            </span>
          </div>

          <input
            type="file"
            ref={(el) => { fileRefs.current[i] = el; }}
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => handleFile(i, e.target.files?.[0] ?? null)}
          />

          {doc.file ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 truncate flex-1">
                📄 {doc.file.name}
              </span>
              <button
                type="button"
                onClick={() => fileRefs.current[i]?.click()}
                className="text-xs text-gray-400 hover:text-white underline"
              >
                Replace
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRefs.current[i]?.click()}
              className="w-full py-3 rounded-lg border-2 border-dashed border-gray-600 hover:border-gray-500 text-gray-400 hover:text-gray-300 text-sm transition-colors"
            >
              + Upload {doc.name}
            </button>
          )}

          {doc.sha256 && (
            <div className="text-xs text-gray-500 font-mono break-all">
              SHA-256: {doc.sha256}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 3: Wallet & Custody ─────────────────────────────────────────────────

function Step3Wallet({
  setup,
  onChange,
}: {
  setup: WalletSetup;
  onChange: (s: WalletSetup) => void;
}) {
  function connectPhantom() {
    // Demo-only stub — real integration calls window.solana.connect().
    // Uses crypto.randomUUID for a unique placeholder address.
    const mockAddress = "7VTe3fWwPn5oJJCfFjD" + crypto.randomUUID().replace(/-/g, "").slice(0, 15);
    onChange({ ...setup, option: "phantom", solanaAddress: mockAddress });
  }

  return (
    <div className="space-y-5">
      {/* Option A: Phantom / Backpack */}
      <div
        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
          setup.option === "phantom"
            ? "border-green-500 bg-green-950/20"
            : "border-gray-700 bg-gray-900 hover:border-gray-600"
        }`}
        onClick={() => onChange({ ...setup, option: "phantom" })}
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">👻</span>
          <div>
            <div className="font-semibold text-white">
              Option A: Phantom / Backpack
            </div>
            <div className="text-xs text-gray-400">
              Browser wallet — connect directly from your browser
            </div>
          </div>
        </div>
        {setup.option === "phantom" && (
          <div className="space-y-3">
            {setup.solanaAddress ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-800">
                <span className="text-green-400 text-sm">✅ Connected:</span>
                <span className="text-xs font-mono text-gray-300 truncate">
                  {setup.solanaAddress}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); connectPhantom(); }}
                className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
              >
                Connect Wallet
              </button>
            )}
          </div>
        )}
      </div>

      {/* Option B: Fireblocks */}
      <div
        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
          setup.option === "fireblocks"
            ? "border-green-500 bg-green-950/20"
            : "border-gray-700 bg-gray-900 hover:border-gray-600"
        }`}
        onClick={() => onChange({ ...setup, option: "fireblocks" })}
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🔐</span>
          <div>
            <div className="font-semibold text-white">
              Option B: Fireblocks MPC Wallet
            </div>
            <div className="text-xs text-gray-400">
              Institutional-grade MPC custody — recommended for banks
            </div>
          </div>
        </div>
        {setup.option === "fireblocks" && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-300 space-y-2">
              <div className="font-medium text-gray-200">Setup Instructions:</div>
              <ol className="list-decimal list-inside space-y-1 text-gray-400">
                <li>Create a Solana vault in your Fireblocks workspace</li>
                <li>Generate a deposit address for the vault</li>
                <li>Configure the webhook below to receive transaction updates</li>
                <li>Enter your Vault Account ID</li>
              </ol>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Fireblocks Vault Account ID
              </label>
              <input
                type="text"
                value={setup.fireblocksVaultId}
                onChange={(e) =>
                  onChange({ ...setup, fireblocksVaultId: e.target.value })
                }
                placeholder="e.g. 12345"
                onClick={(e) => e.stopPropagation()}
                className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Webhook URL (for transaction notifications)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={
                    setup.fireblocksWebhookUrl ||
                    `${typeof window !== "undefined" ? window.location.origin : ""}/api/fireblocks/webhook`
                  }
                  readOnly
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-300 text-xs font-mono focus:outline-none"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(
                      `${window.location.origin}/api/fireblocks/webhook`
                    );
                  }}
                  className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>

            {setup.fireblocksVaultId && (
              <div className="p-2 rounded-lg bg-blue-950/30 border border-blue-800 text-xs text-blue-300">
                Solana address will be derived from Fireblocks vault{" "}
                {setup.fireblocksVaultId} and registered in the KYC registry.
              </div>
            )}
          </div>
        )}
      </div>

      {setup.solanaAddress && (
        <div className="p-3 rounded-lg bg-gray-800 border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">
            Solana address to register in KYC registry:
          </div>
          <div className="text-xs font-mono text-green-400 break-all">
            {setup.solanaAddress}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 4: Travel Rule ──────────────────────────────────────────────────────

function Step4TravelRule({
  config,
  onChange,
}: {
  config: TravelRuleConfig;
  onChange: (c: TravelRuleConfig) => void;
}) {
  async function sendTestMessage() {
    onChange({ ...config, testStatus: "sending" });
    await new Promise((r) => setTimeout(r, 1500));
    onChange({ ...config, testStatus: "success" });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            VASP ID (LEI or BIC) <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={config.vaspId}
            onChange={(e) => onChange({ ...config, vaspId: e.target.value })}
            placeholder="e.g. 5299000J2N45DDNE4Y28 (LEI)"
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            VASP Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={config.vaspName}
            onChange={(e) => onChange({ ...config, vaspName: e.target.value })}
            placeholder="e.g. AMINA Bank AG"
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Jurisdiction <span className="text-red-400">*</span>
        </label>
        <select
          value={config.jurisdiction}
          onChange={(e) =>
            onChange({ ...config, jurisdiction: e.target.value })
          }
          className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-green-500 transition-colors"
        >
          <option value="">— Select jurisdiction —</option>
          {JURISDICTIONS.map((j) => (
            <option key={j.code} value={j.code}>
              {j.flag} {j.name} ({j.code})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Travel Rule Protocol <span className="text-red-400">*</span>
        </label>
        <div className="flex gap-3">
          {TRAVEL_RULE_PROTOCOLS.map((proto) => (
            <label key={proto} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="trProtocol"
                value={proto}
                checked={config.protocol === proto}
                onChange={() => onChange({ ...config, protocol: proto })}
                className="accent-green-500"
              />
              <span
                className={`text-sm font-medium ${
                  config.protocol === proto ? "text-green-400" : "text-gray-400"
                }`}
              >
                {proto}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Counterparty discovery */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Counterparty VASP Discovery
        </label>
        <div className="relative">
          <input
            type="text"
            value={config.counterpartySearch}
            onChange={(e) =>
              onChange({ ...config, counterpartySearch: e.target.value })
            }
            placeholder="Search by name or LEI..."
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
          />
          {config.counterpartySearch.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-lg bg-gray-800 border border-gray-700 shadow-xl z-10">
              {["First Bank Nigeria PLC", "Equity Bank Kenya", "Standard Bank SA"].map(
                (name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() =>
                      onChange({ ...config, counterpartySearch: name })
                    }
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors first:rounded-t-lg last:rounded-b-lg"
                  >
                    {name}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Test message */}
      <div className="p-4 rounded-xl bg-gray-900 border border-gray-700 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-200">
              Test Travel Rule Message
            </div>
            <div className="text-xs text-gray-400">
              Sends a mock {config.protocol} payload and shows the response
            </div>
          </div>
          <button
            type="button"
            disabled={!config.vaspId || config.testStatus === "sending"}
            onClick={sendTestMessage}
            className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium transition-colors"
          >
            {config.testStatus === "sending" ? "Sending..." : "Send Test"}
          </button>
        </div>

        {config.testStatus === "success" && (
          <div className="p-3 rounded-lg bg-green-950/30 border border-green-800 text-xs text-green-300 font-mono space-y-1">
            <div className="text-green-400 font-semibold">
              ✅ {config.protocol} Response received
            </div>
            <div>
              {`{ "status": "ACK", "protocol": "${config.protocol}", "vaspId": "${config.vaspId}", "timestamp": "${new Date().toISOString()}" }`}
            </div>
          </div>
        )}

        {config.testStatus === "error" && (
          <div className="p-3 rounded-lg bg-red-950/30 border border-red-800 text-xs text-red-300">
            ❌ Test failed — check VASP ID and protocol configuration
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({
  profile,
  solanaAddress,
  kycPda,
  institutionId,
}: {
  profile: InstitutionProfile;
  solanaAddress: string;
  kycPda: string;
  institutionId: string;
}) {
  const router = useRouter();

  return (
    <div className="text-center space-y-6 py-8">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-900/40 border-2 border-green-500 text-4xl">
        🎉
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white">
          You are now live on NEXUS Protocol
        </h2>
        <p className="text-gray-400 mt-2">
          {profile.name} has been registered and is ready to settle.
        </p>
      </div>

      <div className="text-left p-5 rounded-xl bg-gray-900 border border-gray-700 space-y-3 max-w-md mx-auto">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Institution ID
          </div>
          <div className="font-mono text-sm text-green-400">{institutionId}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            KYC Record PDA
          </div>
          <div className="font-mono text-xs text-blue-400 break-all">{kycPda}</div>
          <a
            href={`https://explorer.solana.com/address/${kycPda}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-white underline mt-1 inline-block"
          >
            View on Solana Explorer ↗
          </a>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Registered Wallet
          </div>
          <div className="font-mono text-xs text-gray-300 break-all">
            {solanaAddress}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-medium transition-colors"
        >
          Go to Dashboard
        </button>
        <button
          onClick={() => router.push("/trades/new")}
          className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-colors shadow-lg shadow-green-900/40"
        >
          Create your first trade →
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [kycPda, setKycPda] = useState("");
  const [institutionId, setInstitutionId] = useState("");

  const [profile, setProfile] = useState<InstitutionProfile>({
    name: "",
    jurisdiction: "",
    entityType: "Bank",
    licenseNumber: "",
    regulatorName: "",
  });

  const [docs, setDocs] = useState<KycDocument[]>(
    REQUIRED_DOCS.map((name) => ({
      name,
      file: null,
      sha256: "",
      status: "idle",
    }))
  );

  const [walletSetup, setWalletSetup] = useState<WalletSetup>({
    option: "phantom",
    solanaAddress: "",
    fireblocksVaultId: "",
    fireblocksWebhookUrl: "",
  });

  const [travelRule, setTravelRule] = useState<TravelRuleConfig>({
    vaspId: "",
    vaspName: "",
    jurisdiction: "",
    protocol: "TRISA",
    counterpartySearch: "",
    testStatus: "idle",
  });

  function canAdvance(): boolean {
    if (currentStep === 0) {
      return (
        profile.name.trim() !== "" &&
        profile.jurisdiction !== "" &&
        profile.licenseNumber.trim() !== "" &&
        profile.regulatorName.trim() !== ""
      );
    }
    if (currentStep === 1) {
      return docs.some((d) => d.status === "done");
    }
    if (currentStep === 2) {
      return walletSetup.solanaAddress !== "";
    }
    if (currentStep === 3) {
      return (
        travelRule.vaspId.trim() !== "" &&
        travelRule.vaspName.trim() !== "" &&
        travelRule.jurisdiction !== ""
      );
    }
    return true;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError("");

    try {
      const institutionIdVal = `${profile.jurisdiction}-${profile.name
        .replace(/\s+/g, "-")
        .toUpperCase()
        .slice(0, 12)}-001`;

      const res = await fetch("/api/kyc/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: walletSetup.solanaAddress,
          institutionId: institutionIdVal,
          tier: 2, // Default onboarding tier; institutions may request tier upgrade after KYB review
          jurisdiction: profile.jurisdiction,
          vaspId: travelRule.vaspId,
          expiresAt: new Date(
            Date.now() + 365 * 24 * 60 * 60 * 1000
          ).toISOString(),
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        kycRecordPda?: string;
        message?: string;
        error?: string;
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? data.message ?? "Registration failed");
      }

      setKycPda(data.kycRecordPda ?? deriveKycPda(institutionIdVal));
      setInstitutionId(institutionIdVal);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <SuccessScreen
            profile={profile}
            solanaAddress={walletSetup.solanaAddress}
            kycPda={kycPda}
            institutionId={institutionId}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-gray-500 hover:text-white text-sm transition-colors">
              ← Back
            </a>
            <div className="h-4 w-px bg-gray-700" />
            <div>
              <h1 className="text-lg font-bold text-white">
                Institutional Onboarding
              </h1>
              <p className="text-xs text-gray-400">
                Register your institution on NEXUS Protocol
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <StepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />

        {/* Step content */}
        <div className="mb-8">
          {currentStep === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Institution Profile
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  Basic information about your institution
                </p>
              </div>
              <Step1Profile profile={profile} onChange={setProfile} />
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white">KYC Documents</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Upload required compliance documents
                </p>
              </div>
              <Step2KycDocs docs={docs} onChange={setDocs} />
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Wallet & Custody Setup
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  Connect or configure your institutional wallet
                </p>
              </div>
              <Step3Wallet setup={walletSetup} onChange={setWalletSetup} />
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Travel Rule Configuration
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  Configure VASP identity and Travel Rule messaging protocol
                </p>
              </div>
              <Step4TravelRule config={travelRule} onChange={setTravelRule} />
            </div>
          )}
        </div>

        {/* Error */}
        {submitError && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/30 border border-red-800 text-red-300 text-sm">
            ❌ {submitError}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="px-6 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
          >
            ← Back
          </button>

          <div className="text-xs text-gray-500">
            Step {currentStep + 1} of {TOTAL_STEPS}
          </div>

          {currentStep < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={!canAdvance()}
              className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold transition-colors"
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canAdvance() || submitting}
              className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold transition-colors shadow-lg shadow-green-900/40"
            >
              {submitting ? "Registering..." : "Register Institution →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
