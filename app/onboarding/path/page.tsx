"use client";

import { CheckCircle2 } from "lucide-react";
import { PERSONA_OPTIONS } from "@/lib/onboarding/config";
import { useOnboardingStore } from "@/store/useOnboardingStore";

export default function OnboardingPathPage() {
  const selectedPersonaId = useOnboardingStore((state) => state.selectedPersonaId);
  const setSelectedPersona = useOnboardingStore((state) => state.setSelectedPersona);
  const form = useOnboardingStore((state) => state.form);

  return (
    <div>
      <div className="ob-page-title">Choose the operating model</div>
      <div className="ob-page-sub">
        Select the institutional path that best matches how this workspace will
        be used. Nexus uses this to prefill jurisdiction, entity, and travel
        rule defaults before the rest of the setup begins.
      </div>

      <div className="form-section">
        <div className="form-section-title">Operating Model</div>
        <div className="persona-grid">
          {PERSONA_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = option.id === selectedPersonaId;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedPersona(option.id)}
                className={`persona-card ${isSelected ? "is-selected" : ""}`}
              >
                <div className="route-card-head">
                  <div className="app-logo-mark">
                    <Icon size={14} />
                  </div>
                  <span className={`badge ${isSelected ? "bg" : "bs"}`}>
                    {isSelected ? "SELECTED" : "AVAILABLE"}
                  </span>
                </div>
                <div className="persona-card-kicker">{option.eyebrow}</div>
                <div className="persona-card-title">{option.title}</div>
                <div className="persona-card-copy">{option.description}</div>
                <div className="persona-outcomes">
                  {option.outcomes.map((outcome) => (
                    <div key={outcome} className="persona-outcome">
                      <CheckCircle2 size={14} color="var(--green-600)" />
                      <span>{outcome}</span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="info-box">
        <div className="info-box-title">Configuration Preview</div>
        <div className="info-box-text">
          The selected operating model will recommend {form.entityType},{" "}
          jurisdiction {form.jurisdiction}, and {form.travelRuleProtocol} as the
          initial travel rule protocol.
        </div>
      </div>

      <div className="risk-grid">
        <div className="risk-card">
          <div className="risk-card-label">Entity Type</div>
          <div className="risk-card-val blue">{form.entityType}</div>
        </div>
        <div className="risk-card">
          <div className="risk-card-label">Jurisdiction</div>
          <div className="risk-card-val">{form.jurisdiction || "Pending"}</div>
        </div>
        <div className="risk-card">
          <div className="risk-card-label">Travel Rule</div>
          <div className="risk-card-val green">{form.travelRuleProtocol}</div>
        </div>
        <div className="risk-card">
          <div className="risk-card-label">Ready To Continue</div>
          <div className="risk-card-val green">
            {selectedPersonaId ? "YES" : "SELECT"}
          </div>
        </div>
      </div>
    </div>
  );
}
