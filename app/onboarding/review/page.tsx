"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useNexusSession } from "@/hooks/useNexusSession";
import { nexusFetch } from "@/lib/client/nexus-client";
import { getPersona } from "@/lib/onboarding/config";
import { useOnboardingStore } from "@/store/useOnboardingStore";

export default function OnboardingReviewPage() {
  const router = useRouter();
  const { authContext, identity } = useNexusSession();
  const form = useOnboardingStore((state) => state.form);
  const selectedPersonaId = useOnboardingStore((state) => state.selectedPersonaId);
  const setKycRecordPda = useOnboardingStore((state) => state.setKycRecordPda);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedPersona = getPersona(selectedPersonaId);

  async function activateWorkspace() {
    if (!identity.walletAddress) {
      setError("A primary wallet is required before workspace activation.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const kyc = await nexusFetch<{
        kycRecordPda: string;
        success: boolean;
        message: string;
      }>(
        "/api/kyc/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet: identity.walletAddress,
            institutionId: form.lei,
            institutionName: form.name,
            tier: form.kycTier,
            jurisdiction: form.jurisdiction,
            vaspId: form.travelRuleVaspId,
            expiresAt: new Date(form.kycExpiresAt).toISOString(),
            entityType: form.entityType,
            licenseNumber: form.licenseNumber,
            regulatorName: form.regulatorName,
          }),
        },
        authContext
      );

      setKycRecordPda(kyc.kycRecordPda);

      await nexusFetch(
        "/api/institutions/me",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet: identity.walletAddress,
            name: form.name,
            jurisdiction: form.jurisdiction,
            entityType: form.entityType,
            licenseNumber: form.licenseNumber,
            regulatorName: form.regulatorName,
            lei: form.lei,
            kycTier: form.kycTier,
            kycExpiresAt: new Date(form.kycExpiresAt).toISOString(),
            travelRuleVaspId: form.travelRuleVaspId,
            travelRuleVaspName: form.travelRuleVaspName,
            travelRuleProtocol: form.travelRuleProtocol,
            contactEmail: form.contactEmail,
            fireblocksVaultId: form.fireblocksVaultId,
            fireblocksWebhookUrl: form.fireblocksWebhookUrl,
            onboardingCompleted: true,
          }),
        },
        authContext
      );

      setSuccess(kyc.message || "Workspace activated. Redirecting to the dashboard.");
      router.push("/dashboard");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to activate the workspace"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="ob-page-title">Review and go live</div>
      <div className="ob-page-sub">
        Review the institution packet before Nexus creates the live workspace,
        registers the KYC record, and unlocks the operational command center.
      </div>

      <div className="risk-grid">
        <div className="risk-card">
          <div className="risk-card-label">KYC Tier</div>
          <div className="risk-card-val blue">Tier {form.kycTier}</div>
        </div>
        <div className="risk-card">
          <div className="risk-card-label">Travel Rule</div>
          <div className="risk-card-val green">{form.travelRuleProtocol}</div>
        </div>
        <div className="risk-card">
          <div className="risk-card-label">Custody</div>
          <div className="risk-card-val">
            {form.fireblocksVaultId ? "FIREBLOCKS" : "STANDARD"}
          </div>
        </div>
        <div className="risk-card">
          <div className="risk-card-label">Wallet</div>
          <div className="risk-card-val green">
            {identity.walletAddress ? "READY" : "MISSING"}
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">Institution Summary</div>
        <div className="soft-card">
          <div className="summary-list">
            <span className="summary-key">Institution</span>
            <span className="summary-value">{form.name}</span>
            <span className="summary-key">Operating Model</span>
            <span className="summary-value">{selectedPersona?.title ?? "Institution"}</span>
            <span className="summary-key">Jurisdiction</span>
            <span className="summary-value">{form.jurisdiction}</span>
            <span className="summary-key">License</span>
            <span className="summary-value">{form.licenseNumber}</span>
            <span className="summary-key">Regulator</span>
            <span className="summary-value">{form.regulatorName}</span>
            <span className="summary-key">LEI / Identifier</span>
            <span className="summary-value">{form.lei}</span>
            <span className="summary-key">Contact Email</span>
            <span className="summary-value">{form.contactEmail}</span>
            <span className="summary-key">Wallet</span>
            <span className="summary-value">{identity.walletAddress ?? "Not attached"}</span>
            <span className="summary-key">Travel Rule VASP</span>
            <span className="summary-value">
              {form.travelRuleVaspName} · {form.travelRuleVaspId}
            </span>
            <span className="summary-key">Fireblocks Vault</span>
            <span className="summary-value">
              {form.fireblocksVaultId || "Not configured"}
            </span>
          </div>
        </div>
      </div>

      <div className="warning-box">
        <div className="warning-box-text">
          By activating the workspace, Nexus will create the institution KYC
          record, store the compliance profile, and mark onboarding as complete
          for this operator.
        </div>
      </div>

      {error ? (
        <div className="warning-box" style={{ marginTop: "16px" }}>
          <div className="warning-box-text">{error}</div>
        </div>
      ) : null}

      {success ? (
        <div className="info-box" style={{ marginTop: "16px" }}>
          <div className="info-box-title">Activation</div>
          <div className="info-box-text">{success}</div>
        </div>
      ) : null}

      <div className="ob-actions" style={{ marginTop: "24px" }}>
        <button
          type="button"
          className="ob-back-btn"
          onClick={() => router.push("/onboarding/controls")}
        >
          Back
        </button>

        <div className="ob-actions-spacer" />

        <button
          type="button"
          className="ob-next-btn"
          disabled={submitting || !identity.walletAddress}
          onClick={() => void activateWorkspace()}
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Activating
            </>
          ) : (
            "Activate workspace"
          )}
        </button>
      </div>
    </div>
  );
}
