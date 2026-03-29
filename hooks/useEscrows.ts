import { useQuery } from "@tanstack/react-query";
import { nexusFetch } from "@/lib/client/nexus-client";
import { useNexusSession } from "@/hooks/useNexusSession";

export interface EscrowData {
  id: string;
  escrowId: string;
  onChainPda: string;
  importerInstitutionId: string;
  importerInstitutionName: string;
  exporterInstitutionId: string;
  exporterInstitutionName: string;
  depositAmount: string;
  tokenMint: string;
  settlementMint: string;
  status: string;
  conditionsTotal: number;
  conditionsSatisfied: number;
  fxRate?: number | null;
  settlementAmount?: string | null;
  travelRuleAttached: boolean;
  travelRuleLogPda?: string | null;
  sourceOfFundsHash?: string | null;
  createdAt: string;
  expiresAt: string;
  settledAt?: string | null;
}

export function useEscrows() {
  const { identity, authContext } = useNexusSession();

  return useQuery({
    queryKey: ["escrows", identity.walletAddress],
    queryFn: () =>
      nexusFetch<{ escrows: EscrowData[] }>(
        "/api/escrows",
        { cache: "no-store" },
        authContext
      ).then((data) => data.escrows),
    enabled: Boolean(identity.walletAddress),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

export function useEscrow(escrowId: string) {
  const { authContext, identity } = useNexusSession();

  return useQuery({
    queryKey: ["escrow", escrowId, identity.walletAddress],
    queryFn: () =>
      nexusFetch<{ escrow: EscrowData }>(
        `/api/escrows/${encodeURIComponent(escrowId)}`,
        { cache: "no-store" },
        authContext
      ).then((data) => data.escrow),
    enabled: Boolean(escrowId && identity.walletAddress),
    refetchInterval: 5_000,
  });
}
