import { create } from "zustand";

export interface EscrowSummary {
  id: string;
  onChainPda: string;
  importerInstitutionId: string;
  exporterInstitutionId: string;
  depositAmount: bigint;
  tokenMint: string;
  settlementMint: string;
  status: string;
  conditionsTotal: number;
  conditionsSatisfied: number;
  createdAt: Date;
  expiresAt: Date;
  settledAt?: Date;
}

interface TradeStore {
  escrows: EscrowSummary[];
  selectedEscrowId: string | null;
  isLoading: boolean;
  error: string | null;
  setEscrows: (escrows: EscrowSummary[]) => void;
  addEscrow: (escrow: EscrowSummary) => void;
  updateEscrow: (id: string, updates: Partial<EscrowSummary>) => void;
  selectEscrow: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useTradeStore = create<TradeStore>((set) => ({
  escrows: [],
  selectedEscrowId: null,
  isLoading: false,
  error: null,
  setEscrows: (escrows) => set({ escrows }),
  addEscrow: (escrow) =>
    set((state) => ({ escrows: [...state.escrows, escrow] })),
  updateEscrow: (id, updates) =>
    set((state) => ({
      escrows: state.escrows.map((e) =>
        e.id === id ? { ...e, ...updates } : e
      ),
    })),
  selectEscrow: (selectedEscrowId) => set({ selectedEscrowId }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
