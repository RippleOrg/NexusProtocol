"use client";

import { ENTITY_TYPES, JURISDICTIONS } from "@/lib/nexus/constants";
import { useOnboardingStore } from "@/store/useOnboardingStore";

export default function OnboardingProfilePage() {
  const form = useOnboardingStore((state) => state.form);
  const updateForm = useOnboardingStore((state) => state.updateForm);
  const jurisdiction =
    JURISDICTIONS.find((item) => item.code === form.jurisdiction)?.name ??
    form.jurisdiction;

  return (
    <div>
      <div className="ob-page-title">Institution profile</div>
      <div className="ob-page-sub">
        Provide the legal entity and regulatory details behind this workspace.
        These fields are reused across onboarding, counterparty discovery, and
        audit exports.
      </div>

      <div className="form-section">
        <div className="form-section-title">Legal Entity</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              Institution Name<span className="req">*</span>
            </label>
            <input
              className="form-input"
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
              placeholder="AMINA Bank AG"
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Legal Entity Type<span className="req">*</span>
            </label>
            <select
              className="form-select"
              value={form.entityType}
              onChange={(event) =>
                updateForm("entityType", event.target.value as (typeof ENTITY_TYPES)[number])
              }
            >
              {ENTITY_TYPES.map((entityType) => (
                <option key={entityType} value={entityType}>
                  {entityType}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              Jurisdiction<span className="req">*</span>
            </label>
            <select
              className="form-select"
              value={form.jurisdiction}
              onChange={(event) => updateForm("jurisdiction", event.target.value)}
            >
              {JURISDICTIONS.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name} ({item.code})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">
              Regulatory License No.<span className="req">*</span>
            </label>
            <input
              className="form-input"
              value={form.licenseNumber}
              onChange={(event) => updateForm("licenseNumber", event.target.value)}
              placeholder="FINMA-BK-2019-0847"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              Regulator Name<span className="req">*</span>
            </label>
            <input
              className="form-input"
              value={form.regulatorName}
              onChange={(event) => updateForm("regulatorName", event.target.value)}
              placeholder="FINMA"
            />
          </div>
          <div className="form-group">
            <label className="form-label">LEI / Legal Identifier</label>
            <input
              className="form-input"
              value={form.lei}
              onChange={(event) => updateForm("lei", event.target.value)}
              placeholder="506700GE1G29325QX363"
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">Contact Information</div>
        <div className="form-group">
          <label className="form-label">
            Contact Email<span className="req">*</span>
          </label>
          <input
            type="email"
            className="form-input"
            value={form.contactEmail}
            onChange={(event) => updateForm("contactEmail", event.target.value)}
            placeholder="compliance@institution.com"
          />
        </div>
      </div>

      <div className="verify-badge">
        <div className="verify-icon">✓</div>
        <div>
          <div className="verify-text">{jurisdiction} jurisdiction selected</div>
          <div className="verify-sub">
            This setting drives travel-rule defaults, reporting copy, and
            corridor readiness checks.
          </div>
        </div>
      </div>
    </div>
  );
}
