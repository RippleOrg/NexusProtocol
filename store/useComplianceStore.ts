import { create } from "zustand";
import type { AmlScreeningResult } from "@/lib/integrations/chainalysis";

interface ComplianceStore {
  kycTier: number;
  kycExpiresAt: Date | null;
  kycJurisdiction: string;
  amlScreenings: Record<string, AmlScreeningResult>;
  kytAlertCount: number;
  travelRuleLogCount: number;
  setKyc: (tier: number, expiresAt: Date | null, jurisdiction: string) => void;
  addAmlScreening: (wallet: string, result: AmlScreeningResult) => void;
  setKytAlertCount: (count: number) => void;
  incrementTravelRuleLogs: () => void;
  reset: () => void;
}

export const useComplianceStore = create<ComplianceStore>((set) => ({
  kycTier: 0,
  kycExpiresAt: null,
  kycJurisdiction: "",
  amlScreenings: {},
  kytAlertCount: 0,
  travelRuleLogCount: 0,
  setKyc: (kycTier, kycExpiresAt, kycJurisdiction) =>
    set({ kycTier, kycExpiresAt, kycJurisdiction }),
  addAmlScreening: (wallet, result) =>
    set((state) => ({
      amlScreenings: { ...state.amlScreenings, [wallet]: result },
    })),
  setKytAlertCount: (kytAlertCount) => set({ kytAlertCount }),
  incrementTravelRuleLogs: () =>
    set((state) => ({ travelRuleLogCount: state.travelRuleLogCount + 1 })),
  reset: () =>
    set({
      kycTier: 0,
      kycExpiresAt: null,
      kycJurisdiction: "",
      amlScreenings: {},
      kytAlertCount: 0,
      travelRuleLogCount: 0,
    }),
}));
