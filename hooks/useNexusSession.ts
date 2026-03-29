"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useQuery } from "@tanstack/react-query";
import { nexusFetch, type NexusAuthContext } from "@/lib/client/nexus-client";
import type { InstitutionProfile } from "@/lib/nexus/types";

interface LinkedSolanaWalletAccount {
  address: string;
  walletName: string;
}

export interface NexusConnectedWallet {
  address: string;
  signTransaction: NonNullable<ReturnType<typeof useWallet>["signTransaction"]>;
  signAllTransactions?: NonNullable<
    ReturnType<typeof useWallet>["signAllTransactions"]
  >;
}

export function useNexusSession() {
  const [mounted, setMounted] = useState(false);
  const {
    connected,
    publicKey,
    wallet,
    wallets,
    disconnect,
    signTransaction,
    signAllTransactions,
  } = useWallet();
  const { setVisible } = useWalletModal();

  useEffect(() => {
    setMounted(true);
  }, []);

  const walletAddress = publicKey?.toBase58() ?? null;
  const walletName = wallet?.adapter.name ?? null;
  const safeWalletAddress = mounted ? walletAddress : null;
  const safeWalletName = mounted ? walletName : null;

  const linkedWallets = useMemo<LinkedSolanaWalletAccount[]>(
    () =>
      safeWalletAddress
        ? [
            {
              address: safeWalletAddress,
              walletName: safeWalletName ?? "Solana Wallet",
            },
          ]
        : [],
    [safeWalletAddress, safeWalletName]
  );

  const identity = useMemo(
    () => ({
      dynamicUserId: null,
      walletAddress: safeWalletAddress,
      email: null,
      displayName:
        safeWalletName ?? safeWalletAddress?.slice(0, 10) ?? "Operator",
    }),
    [safeWalletAddress, safeWalletName]
  );

  const authContext = useMemo<NexusAuthContext>(
    () => ({
      walletAddress: identity.walletAddress,
    }),
    [identity.walletAddress]
  );

  const institutionQuery = useQuery({
    queryKey: ["institution", "me", identity.walletAddress],
    queryFn: () =>
      nexusFetch<{ institution: InstitutionProfile | null }>(
        "/api/institutions/me",
        { cache: "no-store" },
        authContext
      ),
    enabled: mounted && connected && Boolean(identity.walletAddress),
    staleTime: 30_000,
    retry: false,
  });

  const primaryWallet = useMemo<NexusConnectedWallet | null>(() => {
    if (!safeWalletAddress || !signTransaction) {
      return null;
    }

    return {
      address: safeWalletAddress,
      signTransaction,
      signAllTransactions: signAllTransactions ?? undefined,
    };
  }, [safeWalletAddress, signAllTransactions, signTransaction]);

  return {
    sdkHasLoaded: mounted,
    isLoggedIn: mounted && connected && Boolean(safeWalletAddress),
    identity,
    authContext,
    institution: institutionQuery.data?.institution ?? null,
    institutionQuery,
    linkedWallets,
    availableWallets: wallets,
    primaryWallet,
    openAuthFlow: () => setVisible(true),
    openWalletLinkFlow: () => setVisible(true),
    logout: async () => {
      await disconnect().catch(() => undefined);
    },
  };
}
