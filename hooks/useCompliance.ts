import { useMutation, useQuery } from "@tanstack/react-query";
import { useComplianceStore } from "@/store/useComplianceStore";
import { nexusFetch } from "@/lib/client/nexus-client";
import { useNexusSession } from "@/hooks/useNexusSession";

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
  const { authContext, institution } = useNexusSession();

  return useMutation({
    mutationFn: async (input: AmlScreenInput): Promise<AmlScreenOutput> => {
      const data = await nexusFetch<AmlScreenOutput>(
        "/api/aml/screen",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...input,
            institutionId: input.institutionId ?? institution?.id,
          }),
        },
        authContext
      );

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
  const { authContext } = useNexusSession();

  return useQuery({
    queryKey: ["kyc-status", institutionId],
    queryFn: () =>
      nexusFetch<{
        isActive: boolean;
        tier: number;
        expiresAt: string | null;
        jurisdiction: string;
      }>(
        `/api/kyc/status?institutionId=${encodeURIComponent(institutionId)}`,
        { cache: "no-store" },
        authContext
      ),
    enabled: !!institutionId,
    staleTime: 60_000,
  });
}
