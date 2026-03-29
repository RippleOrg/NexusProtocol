"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_ONBOARDING_FORM,
  getPersona,
  type OnboardingFormState,
  type PersonaId,
  type WalletChoice,
} from "@/lib/onboarding/config";
import {
  ENTITY_TYPES,
  TRAVEL_RULE_PROTOCOLS,
} from "@/lib/nexus/constants";
import type { InstitutionProfile } from "@/lib/nexus/types";

interface OnboardingStore {
  operatorKey: string | null;
  selectedPersonaId: PersonaId | null;
  walletChoice: WalletChoice;
  form: OnboardingFormState;
  kycRecordPda: string | null;
  hydratedInstitutionId: string | null;
  syncOperator: (operatorKey: string | null, email?: string | null) => void;
  setSelectedPersona: (personaId: PersonaId) => void;
  setWalletChoice: (choice: WalletChoice) => void;
  updateForm: <Field extends keyof OnboardingFormState>(
    field: Field,
    value: OnboardingFormState[Field]
  ) => void;
  patchForm: (updates: Partial<OnboardingFormState>) => void;
  syncContactEmail: (email: string | null | undefined) => void;
  syncInstitution: (institution: InstitutionProfile | null) => void;
  setKycRecordPda: (kycRecordPda: string | null) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      operatorKey: null,
      selectedPersonaId: null,
      walletChoice: null,
      form: DEFAULT_ONBOARDING_FORM,
      kycRecordPda: null,
      hydratedInstitutionId: null,
      syncOperator: (operatorKey, email) =>
        set((state) => {
          if (!operatorKey) {
            return state;
          }

          if (state.operatorKey === operatorKey) {
            if (!email || state.form.contactEmail.trim()) {
              return state;
            }

            return {
              form: {
                ...state.form,
                contactEmail: email,
              },
            };
          }

          const persona = getPersona(state.selectedPersonaId);

          return {
            operatorKey,
            walletChoice: null,
            form: {
              ...DEFAULT_ONBOARDING_FORM,
              contactEmail: email ?? "",
              entityType:
                persona?.recommendedEntityType ?? DEFAULT_ONBOARDING_FORM.entityType,
              jurisdiction:
                persona?.recommendedJurisdiction ??
                DEFAULT_ONBOARDING_FORM.jurisdiction,
              travelRuleProtocol:
                persona?.recommendedProtocol ??
                DEFAULT_ONBOARDING_FORM.travelRuleProtocol,
            },
            kycRecordPda: null,
            hydratedInstitutionId: null,
          };
        }),
      setSelectedPersona: (selectedPersonaId) =>
        set((state) => {
          const persona = getPersona(selectedPersonaId);

          return {
            selectedPersonaId,
            form: persona
              ? {
                  ...state.form,
                  entityType: persona.recommendedEntityType,
                  jurisdiction: persona.recommendedJurisdiction,
                  travelRuleProtocol: persona.recommendedProtocol,
                }
              : state.form,
          };
        }),
      setWalletChoice: (walletChoice) => set({ walletChoice }),
      updateForm: (field, value) =>
        set((state) => ({
          form: {
            ...state.form,
            [field]: value,
          },
        })),
      patchForm: (updates) =>
        set((state) => ({
          form: {
            ...state.form,
            ...updates,
          },
        })),
      syncContactEmail: (email) =>
        set((state) => {
          if (!email || state.form.contactEmail.trim()) {
            return state;
          }

          return {
            form: {
              ...state.form,
              contactEmail: email,
            },
          };
        }),
      syncInstitution: (institution) =>
        set((state) => {
          if (!institution || state.hydratedInstitutionId === institution.id) {
            return state;
          }

          return {
            hydratedInstitutionId: institution.id,
            form: {
              ...state.form,
              name: institution.name,
              lei: institution.lei ?? "",
              jurisdiction: institution.jurisdiction,
              entityType: ENTITY_TYPES.includes(
                institution.entityType as (typeof ENTITY_TYPES)[number]
              )
                ? (institution.entityType as (typeof ENTITY_TYPES)[number])
                : state.form.entityType,
              licenseNumber: institution.licenseNumber ?? "",
              regulatorName: institution.regulatorName ?? "",
              contactEmail: institution.contactEmail ?? state.form.contactEmail,
              kycTier: institution.kycTier,
              kycExpiresAt: institution.kycExpiresAt
                ? institution.kycExpiresAt.slice(0, 10)
                : state.form.kycExpiresAt,
              travelRuleProtocol: TRAVEL_RULE_PROTOCOLS.includes(
                institution.travelRuleProtocol as (typeof TRAVEL_RULE_PROTOCOLS)[number]
              )
                ? (institution.travelRuleProtocol as (typeof TRAVEL_RULE_PROTOCOLS)[number])
                : state.form.travelRuleProtocol,
              travelRuleVaspId: institution.travelRuleVaspId ?? "",
              travelRuleVaspName: institution.travelRuleVaspName ?? "",
              fireblocksVaultId: institution.fireblocksVaultId ?? "",
              fireblocksWebhookUrl: institution.fireblocksWebhookUrl ?? "",
            },
          };
        }),
      setKycRecordPda: (kycRecordPda) => set({ kycRecordPda }),
      reset: () =>
        set({
          operatorKey: null,
          selectedPersonaId: null,
          walletChoice: null,
          form: DEFAULT_ONBOARDING_FORM,
          kycRecordPda: null,
          hydratedInstitutionId: null,
        }),
    }),
    {
      name: "nexus-onboarding",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        operatorKey: state.operatorKey,
        selectedPersonaId: state.selectedPersonaId,
        walletChoice: state.walletChoice,
        form: state.form,
        hydratedInstitutionId: state.hydratedInstitutionId,
      }),
    }
  )
);
