"use client";

import { Hexagon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  getBlockingStep,
  getOnboardingCompletion,
  getStepFromPathname,
  getStepIndex,
  ONBOARDING_ROUTE_BY_STEP,
  ONBOARDING_STEPS,
} from "@/lib/onboarding/config";
import { useNexusSession } from "@/hooks/useNexusSession";
import { useOnboardingStore } from "@/store/useOnboardingStore";

const NEXT_LABELS = {
  path: "Continue",
  access: "Continue",
  profile: "Continue",
  controls: "Review setup",
} as const;

export default function OnboardingFlowShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { identity, institution, isLoggedIn, sdkHasLoaded } = useNexusSession();
  const selectedPersonaId = useOnboardingStore((state) => state.selectedPersonaId);
  const form = useOnboardingStore((state) => state.form);
  const syncOperator = useOnboardingStore((state) => state.syncOperator);
  const syncContactEmail = useOnboardingStore((state) => state.syncContactEmail);
  const syncInstitution = useOnboardingStore((state) => state.syncInstitution);

  const activeStep = getStepFromPathname(pathname);
  const activeIndex = getStepIndex(activeStep);
  const nextStep =
    activeIndex < ONBOARDING_STEPS.length - 1
      ? ONBOARDING_STEPS[activeIndex + 1]
      : null;
  const completion = getOnboardingCompletion({
    selectedPersonaId,
    form,
    isLoggedIn,
    walletAddress: identity.walletAddress,
  });
  const nextLabel = activeStep === "review" ? "Activate" : NEXT_LABELS[activeStep];

  useEffect(() => {
    syncOperator(identity.walletAddress ?? identity.email ?? null, identity.email);
  }, [identity.email, identity.walletAddress, syncOperator]);

  useEffect(() => {
    syncContactEmail(identity.email);
  }, [identity.email, syncContactEmail]);

  useEffect(() => {
    syncInstitution(institution);
  }, [institution, syncInstitution]);

  useEffect(() => {
    if (!sdkHasLoaded) {
      return;
    }

    if (institution?.onboardingCompletedAt) {
      router.replace("/dashboard");
      return;
    }

    const blockingStep = getBlockingStep(activeStep, completion);
    if (blockingStep) {
      router.replace(ONBOARDING_ROUTE_BY_STEP[blockingStep.id]);
    }
  }, [
    activeStep,
    completion,
    institution?.onboardingCompletedAt,
    router,
    sdkHasLoaded,
  ]);

  const showShellActions = activeStep !== "review";
  const canContinue = activeStep === "review" ? false : completion[activeStep];

  return (
    <div className="ob-shell">
      <aside className="ob-sidebar">
        <div className="ob-sidebar-logo">
          <div className="ob-sidebar-logo-mark">
            <Hexagon />
          </div>
          <div className="ob-sidebar-logo-name">NEXUS Protocol</div>
        </div>

        <div className="ob-steps-title">Institution Setup</div>

        <div className="ob-step-list">
          {ONBOARDING_STEPS.map((step, index) => {
            const isActive = step.id === activeStep;
            const isComplete = completion[step.id];
            const isAccessible =
              index === 0 ||
              isComplete ||
              index <= activeIndex ||
              completion[ONBOARDING_STEPS[index - 1].id];

            return (
              <button
                key={step.id}
                type="button"
                disabled={!isAccessible}
                onClick={() => router.push(ONBOARDING_ROUTE_BY_STEP[step.id])}
                className={`ob-step-item ${
                  isActive ? "is-active" : ""
                } ${isComplete ? "is-complete" : ""}`}
              >
                <div className="ob-step-icon">{isComplete ? "✓" : index + 1}</div>
                <div>
                  <div className="ob-step-label">{step.title}</div>
                  <div className="ob-step-desc">{step.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="ob-sidebar-bottom">
          <div className="ob-sidebar-note">
            Institution credentials, wallet access, and travel-rule routing are
            prepared here before the workspace activates.
          </div>
        </div>
      </aside>

      <div className="ob-main">
        <div className="ob-topbar">
          <div className="ob-topbar-step">
            Step {activeIndex + 1} of {ONBOARDING_STEPS.length} -{" "}
            {ONBOARDING_STEPS[activeIndex]?.title}
          </div>

          <div className="ob-topbar-progress">
            {ONBOARDING_STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`ob-prog-dot ${
                  completion[step.id] ? "done" : index === activeIndex ? "active" : ""
                }`}
              />
            ))}
          </div>
        </div>

        <div className="ob-content">{children}</div>

        {showShellActions ? (
          <div className="ob-actions">
            <button
              type="button"
              className="ob-back-btn"
              style={{ visibility: activeIndex === 0 ? "hidden" : "visible" }}
              onClick={() => {
                if (activeIndex > 0) {
                  router.push(ONBOARDING_ROUTE_BY_STEP[ONBOARDING_STEPS[activeIndex - 1].id]);
                }
              }}
            >
              Back
            </button>

            <div className="ob-actions-spacer" />

            <button
              type="button"
              className="ob-next-btn"
              disabled={!canContinue || !nextStep}
              onClick={() => {
                if (nextStep && canContinue) {
                  router.push(ONBOARDING_ROUTE_BY_STEP[nextStep.id]);
                }
              }}
            >
              {nextLabel}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
