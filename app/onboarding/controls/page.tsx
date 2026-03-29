"use client";

import { TRAVEL_RULE_PROTOCOLS } from "@/lib/nexus/constants";
import { useOnboardingStore } from "@/store/useOnboardingStore";

export default function OnboardingControlsPage() {
  const form = useOnboardingStore((state) => state.form);
  const updateForm = useOnboardingStore((state) => state.updateForm);

  return (
    <div>
      <div className="ob-page-title">Compliance and custody controls</div>
      <div className="ob-page-sub">
        Configure the compliance window, travel rule identity, and optional
        Fireblocks settings that govern how this institution settles through
        Nexus.
      </div>

      <div className="form-section">
        <div className="form-section-title">KYC Controls</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">KYC Tier</label>
            <select
              className="form-select"
              value={form.kycTier}
              onChange={(event) => updateForm("kycTier", Number(event.target.value))}
            >
              {[1, 2, 3].map((tier) => (
                <option key={tier} value={tier}>
                  Tier {tier}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">
              KYC Valid Until<span className="req">*</span>
            </label>
            <input
              type="date"
              className="form-input"
              value={form.kycExpiresAt}
              onChange={(event) => updateForm("kycExpiresAt", event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">Travel Rule Config</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Travel Rule Protocol</label>
            <select
              className="form-select"
              value={form.travelRuleProtocol}
              onChange={(event) =>
                updateForm(
                  "travelRuleProtocol",
                  event.target.value as (typeof TRAVEL_RULE_PROTOCOLS)[number]
                )
              }
            >
              {TRAVEL_RULE_PROTOCOLS.map((protocol) => (
                <option key={protocol} value={protocol}>
                  {protocol}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">
              VASP ID<span className="req">*</span>
            </label>
            <input
              className="form-input"
              value={form.travelRuleVaspId}
              onChange={(event) => updateForm("travelRuleVaspId", event.target.value)}
              placeholder="AMINCHZZ001"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            VASP Profile Name<span className="req">*</span>
          </label>
          <input
            className="form-input"
            value={form.travelRuleVaspName}
            onChange={(event) => updateForm("travelRuleVaspName", event.target.value)}
            placeholder="AMINA Bank AG"
          />
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">Fireblocks Configuration</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Vault Account ID</label>
            <input
              className="form-input"
              value={form.fireblocksVaultId}
              onChange={(event) => updateForm("fireblocksVaultId", event.target.value)}
              placeholder="4821"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Webhook URL</label>
            <input
              className="form-input"
              value={form.fireblocksWebhookUrl}
              onChange={(event) =>
                updateForm("fireblocksWebhookUrl", event.target.value)
              }
              placeholder="https://ops.nexusprotocol.com/fireblocks/webhook"
            />
          </div>
        </div>
      </div>

      <div className="risk-grid">
        <div className="risk-card">
          <div className="risk-card-label">Travel Rule</div>
          <div className="risk-card-val green">{form.travelRuleProtocol}</div>
        </div>
        <div className="risk-card">
          <div className="risk-card-label">KYC Tier</div>
          <div className="risk-card-val blue">Tier {form.kycTier}</div>
        </div>
        <div className="risk-card">
          <div className="risk-card-label">Custody</div>
          <div className="risk-card-val">
            {form.fireblocksVaultId ? "FIREBLOCKS" : "STANDARD"}
          </div>
        </div>
        <div className="risk-card">
          <div className="risk-card-label">Activation Ready</div>
          <div className="risk-card-val green">
            {form.kycExpiresAt && form.travelRuleVaspId && form.travelRuleVaspName
              ? "YES"
              : "PENDING"}
          </div>
        </div>
      </div>

      <div className="info-box">
        <div className="info-box-title">Straight-through controls</div>
        <div className="info-box-text">
          Travel Rule metadata is attached before settlement, AML checks can
          block release, and Fireblocks can be introduced for higher-value
          approval flows.
        </div>
      </div>
    </div>
  );
}
