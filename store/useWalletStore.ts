import { create } from "zustand";
import { PublicKey } from "@solana/web3.js";

interface WalletStore {
  connected: boolean;
  publicKey: PublicKey | null;
  institutionId: string | null;
  kycTier: number;
  fireblocksEnabled: boolean;
  setWallet: (publicKey: PublicKey | null) => void;
  setInstitutionId: (id: string | null) => void;
  setKycTier: (tier: number) => void;
  setFireblocksEnabled: (enabled: boolean) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletStore>((set) => ({
  connected: false,
  publicKey: null,
  institutionId: null,
  kycTier: 0,
  fireblocksEnabled:
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_FIREBLOCKS_ENABLED === "true"
      : false,
  setWallet: (publicKey) =>
    set({ publicKey, connected: publicKey !== null }),
  setInstitutionId: (institutionId) => set({ institutionId }),
  setKycTier: (kycTier) => set({ kycTier }),
  setFireblocksEnabled: (fireblocksEnabled) => set({ fireblocksEnabled }),
  disconnect: () =>
    set({
      connected: false,
      publicKey: null,
      institutionId: null,
      kycTier: 0,
    }),
}));
