import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWalletStore } from "@/store/useWalletStore";

export interface EscrowData {
  id: string;
  onChainPda: string;
  importerInstitutionId: string;
  exporterInstitutionId: string;
  depositAmount: string;
  tokenMint: string;
  status: string;
  conditionsTotal: number;
  conditionsSatisfied: number;
  createdAt: string;
  expiresAt: string;
}

async function fetchEscrows(institutionId: string): Promise<EscrowData[]> {
  const res = await fetch(
    `/api/escrows?institutionId=${encodeURIComponent(institutionId)}`
  );
  if (!res.ok) throw new Error("Failed to fetch escrows");
  const data = (await res.json()) as { escrows: EscrowData[] };
  return data.escrows;
}

export function useEscrows() {
  const { institutionId } = useWalletStore();
  return useQuery({
    queryKey: ["escrows", institutionId],
    queryFn: () => fetchEscrows(institutionId ?? ""),
    enabled: !!institutionId,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

export function useEscrow(escrowId: string) {
  return useQuery({
    queryKey: ["escrow", escrowId],
    queryFn: async () => {
      const res = await fetch(`/api/escrows/${encodeURIComponent(escrowId)}`);
      if (!res.ok) throw new Error("Failed to fetch escrow");
      return (await res.json()) as EscrowData;
    },
    enabled: !!escrowId,
    refetchInterval: 5_000,
  });
}
