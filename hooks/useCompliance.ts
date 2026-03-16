import { useMutation, useQuery } from "@tanstack/react-query";
import { useComplianceStore } from "@/store/useComplianceStore";

export interface AmlScreenInput {
  wallet: string;
  escrowId?: string;
  amount?: number;
  institutionId?: string;
}

export interface AmlScreenOutput {
  result?: {
    riskScore: number;
    isSanctioned: boolean;
    recommendation: "CLEAR" | "REVIEW" | "BLOCK";
    riskCategories: string[];
  };
  error?: string;
  status?: string;
}

export function useAmlScreen() {
  const { addAmlScreening } = useComplianceStore();

  return useMutation({
    mutationFn: async (input: AmlScreenInput): Promise<AmlScreenOutput> => {
      const res = await fetch("/api/aml/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as AmlScreenOutput;
      if (data.result) {
        addAmlScreening(input.wallet, {
          ...data.result,
          address: input.wallet,
          screenedAt: Date.now(),
          provider: "CHAINALYSIS",
        });
      }
      return data;
    },
  });
}

export function useKycStatus(institutionId: string) {
  return useQuery({
    queryKey: ["kyc-status", institutionId],
    queryFn: async () => {
      const res = await fetch(
        `/api/kyc/status?institutionId=${encodeURIComponent(institutionId)}`
      );
      if (!res.ok) throw new Error("Failed to fetch KYC status");
      return res.json() as Promise<{
        isActive: boolean;
        tier: number;
        expiresAt: string | null;
        jurisdiction: string;
      }>;
    },
    enabled: !!institutionId,
    staleTime: 60_000,
  });
}
