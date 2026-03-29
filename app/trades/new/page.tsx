"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useNexusSession } from "@/hooks/useNexusSession";
import { nexusFetch } from "@/lib/client/nexus-client";
import {
  createAndFundEscrowOnChain,
  type EscrowCreationProgress,
} from "@/lib/nexus/client-program";
import { useFxRates } from "@/hooks/useFxVenue";
import { SUPPORTED_SETTLEMENT_INSTRUMENTS } from "@/lib/nexus/constants";
import type {
  EscrowRecord,
  InstitutionDirectoryItem,
  TradeConditionInput,
  TradeConditionType,
} from "@/lib/nexus/types";

const CONDITION_OPTIONS: Array<{
  value: TradeConditionType;
  label: string;
  hint: string;
}> = [
  {
    value: "DocumentHash",
    label: "Document hash verification",
    hint: "Release only when a hashed proof matches the source-of-funds or shipping file.",
  },
  {
    value: "ManualApproval",
    label: "Manual sign-off",
    hint: "Require a human approval step before settlement progresses.",
  },
  {
    value: "TimeBased",
    label: "Time gate",
    hint: "Hold release until a defined deadline has passed.",
  },
  {
    value: "MultiSigApproval",
    label: "Multi-sig approval",
    hint: "Reserve the instruction for multi-party treasury approval.",
  },
];

function createCondition(): TradeConditionInput {
  return {
    conditionType: "DocumentHash",
    description: "",
    documentHash: "",
    releaseBps: 10_000,
  };
}

function explorerUrl(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export default function NewTradePage() {
  const router = useRouter();
  const { authContext, institution, primaryWallet } = useNexusSession();
  const fxRatesQuery = useFxRates();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletProgress, setWalletProgress] =
    useState<EscrowCreationProgress | null>(null);
  const [confirmedSignatures, setConfirmedSignatures] = useState<
    Array<{ label: string; signature: string }>
  >([]);
  const [counterpartyInstitutionId, setCounterpartyInstitutionId] = useState("");
  const [settlementInstrument, setSettlementInstrument] = useState<
    (typeof SUPPORTED_SETTLEMENT_INSTRUMENTS)[number]["code"]
  >(SUPPORTED_SETTLEMENT_INSTRUMENTS[0].code);
  const [depositAmountUsdc, setDepositAmountUsdc] = useState("");
  const [fxRateBandBps, setFxRateBandBps] = useState(75);
  const [expiresAt, setExpiresAt] = useState("");
  const [sourceOfFundsHash, setSourceOfFundsHash] = useState("");
  const [conditions, setConditions] = useState<TradeConditionInput[]>([
    createCondition(),
  ]);
  const [travelRule, setTravelRule] = useState({
    originatorName: "",
    originatorAccount: "",
    beneficiaryName: "",
    beneficiaryAccount: "",
    transactionReference: "",
  });

  const directoryQuery = useQuery({
    queryKey: ["institution-directory"],
    queryFn: () =>
      nexusFetch<{ institutions: InstitutionDirectoryItem[] }>(
        "/api/institutions/directory",
        { cache: "no-store" },
        authContext
      ),
    enabled: Boolean(institution),
    staleTime: 30_000,
  });

  const selectedInstrument = useMemo(
    () =>
      SUPPORTED_SETTLEMENT_INSTRUMENTS.find(
        (option) => option.code === settlementInstrument
      ) ?? SUPPORTED_SETTLEMENT_INSTRUMENTS[0],
    [settlementInstrument]
  );

  const selectedRate = useMemo(
    () =>
      fxRatesQuery.data?.find((rate) => rate.pair === selectedInstrument.pair),
    [fxRatesQuery.data, selectedInstrument.pair]
  );

  const selectedCounterparty = useMemo(
    () =>
      directoryQuery.data?.institutions.find(
        (counterparty) => counterparty.id === counterpartyInstitutionId
      ),
    [counterpartyInstitutionId, directoryQuery.data?.institutions]
  );

  useEffect(() => {
    const requestedInstrument = new URLSearchParams(window.location.search).get(
      "instrument"
    );

    if (
      requestedInstrument &&
      SUPPORTED_SETTLEMENT_INSTRUMENTS.some(
        (instrument) => instrument.code === requestedInstrument
      )
    ) {
      setSettlementInstrument(
        requestedInstrument as (typeof SUPPORTED_SETTLEMENT_INSTRUMENTS)[number]["code"]
      );
    }
  }, []);

  useEffect(() => {
    if (!institution) {
      return;
    }

    setTravelRule((current) => ({
      ...current,
      originatorName: current.originatorName || institution.name,
    }));
  }, [institution]);

  useEffect(() => {
    if (!selectedCounterparty) {
      return;
    }

    setTravelRule((current) => ({
      ...current,
      beneficiaryName: current.beneficiaryName || selectedCounterparty.name,
    }));
  }, [selectedCounterparty]);

  const handleConditionChange = (
    index: number,
    updates: Partial<TradeConditionInput>
  ) => {
    setConditions((current) =>
      current.map((condition, currentIndex) =>
        currentIndex === index ? { ...condition, ...updates } : condition
      )
    );
  };

  const addCondition = () => {
    setConditions((current) => [...current, createCondition()]);
  };

  const removeCondition = (index: number) => {
    setConditions((current) =>
      current.length === 1
        ? current
        : current.filter((_, currentIndex) => currentIndex !== index)
    );
  };

  const submitTrade = async () => {
    setSubmitting(true);
    setError(null);
    setWalletProgress(null);
    setConfirmedSignatures([]);

    try {
      if (!institution) {
        throw new Error("Complete onboarding before creating a trade");
      }

      if (!institution.onChainInstitutionId) {
        throw new Error(
          "Institution KYC is missing its on-chain identifier. Re-run onboarding to continue."
        );
      }

      if (!selectedCounterparty) {
        throw new Error("Select a counterparty institution");
      }

      if (!primaryWallet) {
        throw new Error("Connect a primary wallet before creating a trade");
      }

      const tradeInput = {
        counterpartyInstitutionId,
        depositAmountUsdc: Number(depositAmountUsdc),
        settlementInstrument: selectedInstrument.settlementMint,
        fxPair: selectedInstrument.pair,
        fxRateReference: selectedRate?.rate ?? 0,
        fxRateBandBps,
        expiresAt: new Date(expiresAt).toISOString(),
        sourceOfFundsHash,
        conditions,
        travelRule,
      };

      const onChainTrade = await createAndFundEscrowOnChain({
        wallet: primaryWallet,
        importerInstitutionId: institution.onChainInstitutionId,
        counterparty: selectedCounterparty,
        trade: tradeInput,
        onStatusChange: (progress) => {
          setWalletProgress(progress);

          if (progress.signature) {
            const signature = progress.signature;
            setConfirmedSignatures((current) => {
              if (current.some((item) => item.signature === signature)) {
                return current;
              }

              return [
                ...current,
                {
                  label:
                    progress.step === "ata_confirmed"
                      ? "ATA setup"
                      : progress.step === "create_confirmed"
                        ? "Create escrow"
                        : "Fund escrow",
                  signature,
                },
              ];
            });
          }
        },
      });
      setWalletProgress({
        step: "fund_confirmed",
        label: "Saving the trade record in the app ledger",
      });

      const payload = await nexusFetch<{ escrow: EscrowRecord }>(
        "/api/escrows",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...tradeInput,
            escrowSeed: onChainTrade.escrowId,
            onChainPda: onChainTrade.onChainPda,
            travelRuleSeed: onChainTrade.travelRuleLogId,
            travelRuleLogPda: onChainTrade.travelRuleLogPda,
            createSignature: onChainTrade.createSignature,
            fundSignature: onChainTrade.fundSignature,
          }),
        },
        authContext
      );

      router.push(`/trades/${payload.escrow.id}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create trade"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    Boolean(counterpartyInstitutionId) &&
    Boolean(institution?.onChainInstitutionId) &&
    Boolean(primaryWallet?.address) &&
    Boolean(depositAmountUsdc) &&
    Number(depositAmountUsdc) > 0 &&
    Boolean(expiresAt) &&
    /^[a-fA-F0-9]{64}$/.test(sourceOfFundsHash) &&
    conditions.every((condition) => condition.description.trim().length >= 4) &&
    Boolean(travelRule.originatorName) &&
    Boolean(travelRule.originatorAccount) &&
    Boolean(travelRule.beneficiaryName) &&
    Boolean(travelRule.beneficiaryAccount) &&
    Boolean(travelRule.transactionReference) &&
    Boolean(selectedRate);

  const stepProgress = [
    Boolean(selectedCounterparty),
    Boolean(depositAmountUsdc) && Boolean(expiresAt) && Boolean(selectedRate),
    conditions.every((condition) => condition.description.trim().length >= 4),
    Boolean(sourceOfFundsHash) &&
      Boolean(travelRule.originatorAccount) &&
      Boolean(travelRule.beneficiaryAccount) &&
      Boolean(travelRule.transactionReference),
    canSubmit,
  ];

  return (
    <div className="two-col">
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">New Trade Escrow</div>
          <span className="badge bb">
            {selectedCounterparty?.name ? `LIVE: ${selectedCounterparty.name}` : "SELECT COUNTERPARTY"}
          </span>
        </div>

        <div className="panel-body">
          <div style={{ display: "flex", gap: "3px", marginBottom: "20px" }}>
            {stepProgress.map((complete, index) => (
              <div
                key={index}
                style={{
                  flex: 1,
                  height: "3px",
                  borderRadius: "2px",
                  background: complete ? "var(--accent)" : "var(--border)",
                }}
              />
            ))}
          </div>

          <div className="form-section">
            <div className="form-section-title">Step 1 - Counterparty</div>
            {directoryQuery.isLoading ? (
              <div className="soft-card">Loading onboarded institutions...</div>
            ) : !directoryQuery.data?.institutions.length ? (
              <div className="soft-card">
                Another institution needs to complete onboarding before it can
                be selected for settlement.
              </div>
            ) : (
              <div className="route-card-list">
                {directoryQuery.data.institutions.map((counterparty) => {
                  const selected = counterparty.id === counterpartyInstitutionId;

                  return (
                    <button
                      key={counterparty.id}
                      type="button"
                      onClick={() => setCounterpartyInstitutionId(counterparty.id)}
                      className={`route-card ${selected ? "is-selected" : ""}`}
                    >
                      <div className="route-card-head">
                        <div>
                          <div className="route-card-title">{counterparty.name}</div>
                          <div className="route-card-copy">
                            {counterparty.jurisdiction} · wallet {counterparty.wallet.slice(0, 10)}...
                          </div>
                        </div>
                        <span className={`badge ${selected ? "bg" : "bs"}`}>
                          Tier {counterparty.kycTier}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="form-section">
            <div className="form-section-title">Step 2 - Trade Terms</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Settlement Instrument</label>
                <select
                  className="form-select"
                  value={settlementInstrument}
                  onChange={(event) =>
                    setSettlementInstrument(
                      event.target.value as (typeof SUPPORTED_SETTLEMENT_INSTRUMENTS)[number]["code"]
                    )
                  }
                >
                  {SUPPORTED_SETTLEMENT_INSTRUMENTS.map((instrument) => (
                    <option key={instrument.code} value={instrument.code}>
                      {instrument.code} - {instrument.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Escrow Amount (USDC)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={depositAmountUsdc}
                  onChange={(event) => setDepositAmountUsdc(event.target.value)}
                  className="form-input"
                  placeholder="500000"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Expiry</label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">FX Rate Band (bps)</label>
                <input
                  type="number"
                  min="25"
                  max="250"
                  step="25"
                  value={fxRateBandBps}
                  onChange={(event) => setFxRateBandBps(Number(event.target.value))}
                  className="form-input"
                />
              </div>
            </div>

            <div className="info-box" style={{ marginBottom: 0 }}>
              <div className="info-box-title">
                SIX BFI Live Rate · {selectedInstrument.valorBc}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <div className="info-box-text">
                  1 {selectedInstrument.code} corridor reference ={" "}
                  {selectedRate ? selectedRate.rate.toFixed(4) : "Unavailable"}
                </div>
                <div className="verify-text">
                  Exporter receives{" "}
                  {selectedRate && depositAmountUsdc
                    ? (selectedRate.rate * Number(depositAmountUsdc)).toLocaleString()
                    : "--"}
                </div>
              </div>
            </div>
          </div>

          <div className="form-section">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                marginBottom: "12px",
              }}
            >
              <div className="form-section-title" style={{ marginBottom: 0, flex: 1 }}>
                Step 3 - Release Conditions
              </div>
              <button type="button" className="btn-outline" onClick={addCondition}>
                <Plus size={14} />
                Add condition
              </button>
            </div>

            <div className="cond-list">
              {conditions.map((condition, index) => {
                const option = CONDITION_OPTIONS.find(
                  (item) => item.value === condition.conditionType
                );

                return (
                  <div key={index} className="soft-card">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <div className="route-card-title" style={{ fontSize: "16px" }}>
                          Condition {index + 1}
                        </div>
                        <div className="route-card-copy">{option?.hint}</div>
                      </div>
                      <button
                        type="button"
                        className="nexus-icon-button"
                        onClick={() => removeCondition(index)}
                        disabled={conditions.length === 1}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="form-row" style={{ marginTop: "14px" }}>
                      <div className="form-group">
                        <label className="form-label">Condition Type</label>
                        <select
                          className="form-select"
                          value={condition.conditionType}
                          onChange={(event) =>
                            handleConditionChange(index, {
                              conditionType: event.target.value as TradeConditionType,
                            })
                          }
                        >
                          {CONDITION_OPTIONS.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Release Bps</label>
                        <input
                          type="number"
                          min="0"
                          max="10000"
                          step="100"
                          className="form-input"
                          value={condition.releaseBps}
                          onChange={(event) =>
                            handleConditionChange(index, {
                              releaseBps: Number(event.target.value),
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <input
                        className="form-input"
                        value={condition.description}
                        onChange={(event) =>
                          handleConditionChange(index, {
                            description: event.target.value,
                          })
                        }
                        placeholder="Bill of lading, inspection sign-off, treasury approval..."
                      />
                    </div>

                    {condition.conditionType === "DocumentHash" ? (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Document Hash</label>
                        <input
                          className="form-input"
                          value={condition.documentHash ?? ""}
                          onChange={(event) =>
                            handleConditionChange(index, {
                              documentHash: event.target.value,
                            })
                          }
                          placeholder="Optional proof hash for verification"
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Step 4 - Compliance & Travel Rule</div>
            <div className="form-group">
              <label className="form-label">Source of Funds Hash (SHA-256)</label>
              <input
                className="form-input"
                value={sourceOfFundsHash}
                onChange={(event) => setSourceOfFundsHash(event.target.value)}
                placeholder="64-character SHA-256 digest"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Originator Name</label>
                <input
                  className="form-input"
                  value={travelRule.originatorName}
                  onChange={(event) =>
                    setTravelRule((current) => ({
                      ...current,
                      originatorName: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Originator Account</label>
                <input
                  className="form-input"
                  value={travelRule.originatorAccount}
                  onChange={(event) =>
                    setTravelRule((current) => ({
                      ...current,
                      originatorAccount: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Beneficiary Name</label>
                <input
                  className="form-input"
                  value={travelRule.beneficiaryName}
                  onChange={(event) =>
                    setTravelRule((current) => ({
                      ...current,
                      beneficiaryName: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Beneficiary Account</label>
                <input
                  className="form-input"
                  value={travelRule.beneficiaryAccount}
                  onChange={(event) =>
                    setTravelRule((current) => ({
                      ...current,
                      beneficiaryAccount: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Transaction Reference</label>
              <input
                className="form-input"
                value={travelRule.transactionReference}
                onChange={(event) =>
                  setTravelRule((current) => ({
                    ...current,
                    transactionReference: event.target.value,
                  }))
                }
                placeholder="Invoice, letter of credit, or payment reference"
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Execution Brief</div>
          </div>
          <div className="panel-body">
            <div className="detail-box">
              <div className="detail-box-label">{selectedInstrument.pairLabel}</div>
              <div className="detail-box-val">
                {selectedRate ? selectedRate.rate.toFixed(4) : "Unavailable"}
              </div>
              <div className="detail-box-sub">
                Bid {selectedRate?.bid.toFixed(4) ?? "--"} · Ask{" "}
                {selectedRate?.ask.toFixed(4) ?? "--"}
              </div>
            </div>

            <div className="summary-stack" style={{ marginTop: "14px", gap: "10px" }}>
              <div className="comp-row">
                <span className="comp-row-label">Counterparty</span>
                <span className="badge bs">
                  {selectedCounterparty?.name ?? "Select institution"}
                </span>
              </div>
              <div className="comp-row">
                <span className="comp-row-label">Deposit Notional</span>
                <span className="badge bs">
                  {depositAmountUsdc ? `${depositAmountUsdc} USDC` : "Pending"}
                </span>
              </div>
              <div className="comp-row">
                <span className="comp-row-label">Travel Rule Ref</span>
                <span className="badge bs">
                  {travelRule.transactionReference || "Pending"}
                </span>
              </div>
              <div className="comp-row">
                <span className="comp-row-label">Wallet</span>
                <span className={`badge ${primaryWallet?.address ? "bg" : "ba"}`}>
                  {primaryWallet?.address ? "READY" : "REQUIRED"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Step 5 - Risk Assessment & Submit</div>
          </div>
          <div className="panel-body">
            <div className="risk-grid">
              <div className="risk-card">
                <div className="risk-card-label">Counterparty</div>
                <div className="risk-card-val green">
                  {selectedCounterparty ? "READY" : "PENDING"}
                </div>
              </div>
              <div className="risk-card">
                <div className="risk-card-label">Rate Reference</div>
                <div className="risk-card-val blue">
                  {selectedRate ? "LIVE" : "WAIT"}
                </div>
              </div>
              <div className="risk-card">
                <div className="risk-card-label">Conditions</div>
                <div className="risk-card-val">
                  {conditions.length}
                </div>
              </div>
              <div className="risk-card">
                <div className="risk-card-label">Submission</div>
                <div className="risk-card-val green">{canSubmit ? "READY" : "BLOCKED"}</div>
              </div>
            </div>

            {error ? (
              <div className="warning-box" style={{ marginTop: "12px" }}>
                <div className="warning-box-text">{error}</div>
              </div>
            ) : null}

            {walletProgress ? (
              <div className="info-box" style={{ marginTop: "12px" }}>
                <div className="info-box-title">Wallet Confirmation</div>
                <div className="info-box-text">{walletProgress.label}</div>
                {confirmedSignatures.length ? (
                  <div style={{ display: "grid", gap: "8px", marginTop: "12px" }}>
                    {confirmedSignatures.map((item) => (
                      <a
                        key={item.signature}
                        href={explorerUrl(item.signature)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-outline"
                        style={{ justifyContent: "center" }}
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              onClick={submitTrade}
              disabled={!canSubmit || submitting}
              className="settle-btn"
              style={{ width: "100%", marginTop: "12px" }}
            >
              {submitting
                ? walletProgress?.label ?? "Creating instruction..."
                : "Create Escrow On-Chain"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
