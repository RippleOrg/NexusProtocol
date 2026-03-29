import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Building2,
  Landmark,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import {
  ENTITY_TYPES,
  JURISDICTIONS,
  TRAVEL_RULE_PROTOCOLS,
} from "@/lib/nexus/constants";
import type { EntityType, TravelRuleProtocol } from "@/lib/nexus/types";

export type StepId = "path" | "access" | "profile" | "controls" | "review";
export type WalletChoice = "managed" | "external" | null;
export type PersonaId = "treasury" | "compliance" | "network";

export interface OnboardingFormState {
  name: string;
  lei: string;
  jurisdiction: string;
  entityType: EntityType;
  licenseNumber: string;
  regulatorName: string;
  contactEmail: string;
  kycTier: number;
  kycExpiresAt: string;
  travelRuleProtocol: TravelRuleProtocol;
  travelRuleVaspId: string;
  travelRuleVaspName: string;
  fireblocksVaultId: string;
  fireblocksWebhookUrl: string;
}

export interface PersonaOption {
  id: PersonaId;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  walkthrough: string[];
  outcomes: string[];
  recommendedEntityType: EntityType;
  recommendedJurisdiction: string;
  recommendedProtocol: TravelRuleProtocol;
}

export const DEFAULT_ONBOARDING_FORM: OnboardingFormState = {
  name: "",
  lei: "",
  jurisdiction: JURISDICTIONS[0]?.code ?? "NG",
  entityType: ENTITY_TYPES[0],
  licenseNumber: "",
  regulatorName: "",
  contactEmail: "",
  kycTier: 3,
  kycExpiresAt: "",
  travelRuleProtocol: TRAVEL_RULE_PROTOCOLS[0],
  travelRuleVaspId: "",
  travelRuleVaspName: "",
  fireblocksVaultId: "",
  fireblocksWebhookUrl: "",
};

export const PERSONA_OPTIONS: PersonaOption[] = [
  {
    id: "treasury",
    icon: Landmark,
    eyebrow: "Recommended for banks",
    title: "Treasury operations",
    description:
      "Set up a desk for corridor pricing, settlement preparation, and custody-linked execution.",
    walkthrough: [
      "Authenticate the operator and connect the Solana wallet used for settlement.",
      "Load regulated entity data, licensing details, and corridor jurisdiction defaults.",
      "Enable travel rule routing and custody hooks before the desk goes live.",
    ],
    outcomes: [
      "Faster trade origination",
      "Rate-band protected settlement",
      "Custody-ready onboarding",
    ],
    recommendedEntityType: "Bank",
    recommendedJurisdiction: "NG",
    recommendedProtocol: "TRISA",
  },
  {
    id: "compliance",
    icon: ShieldCheck,
    eyebrow: "Best for regulated teams",
    title: "Compliance command",
    description:
      "Prioritize KYC readiness, travel-rule coverage, and regulator-facing reporting from day one.",
    walkthrough: [
      "Authenticate the compliance lead and connect the operator wallet.",
      "Capture LEI, regulator, KYC validity, and contact details for the operating entity.",
      "Configure travel-rule metadata and review the audit-ready summary before launch.",
    ],
    outcomes: [
      "Audit-ready institution profile",
      "Clear approval milestones",
      "Reporting-first onboarding",
    ],
    recommendedEntityType: "Licensed Fintech",
    recommendedJurisdiction: "CH",
    recommendedProtocol: "OpenVASP",
  },
  {
    id: "network",
    icon: Waypoints,
    eyebrow: "Best for liquidity partners",
    title: "Settlement network partner",
    description:
      "Stand up a production workspace for counterparties, corridors, and programmable settlement controls.",
    walkthrough: [
      "Authenticate the operator and establish the wallet used for settlement coordination.",
      "Attach the legal entity, licensing details, and operating jurisdiction.",
      "Set travel-rule identifiers and handoff webhooks for straight-through processing.",
    ],
    outcomes: [
      "Partner-ready workspace",
      "Shared settlement routing",
      "Operational handoff clarity",
    ],
    recommendedEntityType: "Broker-Dealer",
    recommendedJurisdiction: "US",
    recommendedProtocol: "SYGNA",
  },
];

export const ONBOARDING_STEPS: Array<{
  id: StepId;
  title: string;
  description: string;
  eyebrow: string;
  icon: LucideIcon;
}> = [
  {
    id: "path",
    title: "Choose your operating model",
    description: "Tell Nexus how this workspace will be used.",
    eyebrow: "Path",
    icon: Building2,
  },
  {
    id: "access",
    title: "Authenticate and connect wallet",
    description: "Sign in the operator and connect the Solana settlement wallet.",
    eyebrow: "Access",
    icon: Landmark,
  },
  {
    id: "profile",
    title: "Capture the institution profile",
    description: "Record legal-entity and licensing details for the workspace.",
    eyebrow: "Profile",
    icon: Building2,
  },
  {
    id: "controls",
    title: "Configure compliance controls",
    description: "Attach KYC, travel rule, and custody-linked control points.",
    eyebrow: "Controls",
    icon: ShieldCheck,
  },
  {
    id: "review",
    title: "Review and activate the workspace",
    description: "Confirm every control before the institution goes live.",
    eyebrow: "Review",
    icon: ArrowLeftRight,
  },
];

export const ONBOARDING_ROUTE_BY_STEP: Record<StepId, string> = {
  path: "/onboarding/path",
  access: "/onboarding/access",
  profile: "/onboarding/profile",
  controls: "/onboarding/controls",
  review: "/onboarding/review",
};

export function getPersona(personaId: PersonaId | null) {
  return PERSONA_OPTIONS.find((option) => option.id === personaId) ?? null;
}

export function getStepIndex(stepId: StepId) {
  return ONBOARDING_STEPS.findIndex((step) => step.id === stepId);
}

export function getStepFromPathname(pathname: string): StepId {
  const exactMatch = Object.entries(ONBOARDING_ROUTE_BY_STEP).find(
    ([, route]) => route === pathname
  );

  if (exactMatch) {
    return exactMatch[0] as StepId;
  }

  return "path";
}

export function getPreviousStep(stepId: StepId) {
  const index = getStepIndex(stepId);
  return index > 0 ? ONBOARDING_STEPS[index - 1] : null;
}

export interface OnboardingCompletionState {
  path: boolean;
  access: boolean;
  profile: boolean;
  controls: boolean;
  review: boolean;
}

export function getOnboardingCompletion(params: {
  selectedPersonaId: PersonaId | null;
  form: OnboardingFormState;
  isLoggedIn: boolean;
  walletAddress: string | null;
}) {
  const { form, isLoggedIn, selectedPersonaId, walletAddress } = params;

  const profileComplete =
    Boolean(form.name.trim()) &&
    Boolean(form.lei.trim()) &&
    Boolean(form.licenseNumber.trim()) &&
    Boolean(form.regulatorName.trim()) &&
    Boolean(form.contactEmail.trim());

  const controlsComplete =
    Boolean(form.kycExpiresAt) &&
    Boolean(form.travelRuleVaspId.trim()) &&
    Boolean(form.travelRuleVaspName.trim());

  const completion: OnboardingCompletionState = {
    path: Boolean(selectedPersonaId),
    access: isLoggedIn && Boolean(walletAddress),
    profile: profileComplete,
    controls: controlsComplete,
    review: profileComplete && controlsComplete && Boolean(walletAddress),
  };

  return completion;
}

export function getBlockingStep(stepId: StepId, completion: OnboardingCompletionState) {
  const currentIndex = getStepIndex(stepId);

  for (let index = 0; index < currentIndex; index += 1) {
    const step = ONBOARDING_STEPS[index];
    if (!completion[step.id]) {
      return step;
    }
  }

  return null;
}
