import OnboardingFlowShell from "@/components/onboarding/onboarding-flow-shell";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OnboardingFlowShell>{children}</OnboardingFlowShell>;
}
