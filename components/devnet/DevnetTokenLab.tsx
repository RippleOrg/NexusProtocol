"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useNexusSession } from "@/hooks/useNexusSession";
import { nexusFetch } from "@/lib/client/nexus-client";
import {
  DEVNET_FAUCET_LINKS,
  DEVNET_TEST_ASSETS,
} from "@/lib/nexus/constants";

interface MintDevnetAssetResponse {
  success: boolean;
  asset: string;
  mint: string;
  tokenAccount: string;
  amount: string;
  uiAmount: number;
  signature: string;
}

interface DevnetBalanceAsset {
  code: string;
  label: string;
  mint: string;
  kind: "official" | "custom";
  amount: string;
  uiAmount: number;
  decimals: number;
  tokenAccounts: string[];
}

interface DevnetBalancesResponse {
  walletAddress: string;
  rpcUrl: string;
  sol: {
    lamports: string;
    amount: number;
  };
  assets: DevnetBalanceAsset[];
  refreshedAt: string;
}

type DevnetTestAsset = {
  code: string;
  label: string;
  mint: string;
  kind: "official" | "custom";
  description: string;
  mintableInApp: boolean;
  faucetUrl?: string;
};

const DEFAULT_AMOUNTS: Record<string, string> = {
  NGNC: "10000",
  KESC: "10000",
  GHSC: "10000",
  GBPC: "5000",
};

function explorerUrl(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export default function DevnetTokenLab() {
  const { authContext, identity, isLoggedIn } = useNexusSession();
  const queryClient = useQueryClient();
  const [amountByCode, setAmountByCode] = useState<Record<string, string>>(
    DEFAULT_AMOUNTS
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const devnetAssets = DEVNET_TEST_ASSETS as readonly DevnetTestAsset[];
  const balancesQuery = useQuery({
    queryKey: ["devnet-balances", identity.walletAddress],
    queryFn: () =>
      nexusFetch<DevnetBalancesResponse>(
        "/api/devnet/balances",
        { cache: "no-store" },
        authContext
      ),
    enabled: isLoggedIn && Boolean(identity.walletAddress),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
  const balancesByCode = useMemo(
    () =>
      new Map(
        (balancesQuery.data?.assets ?? []).map((asset) => [asset.code, asset])
      ),
    [balancesQuery.data?.assets]
  );

  const officialAssets = useMemo(
    () => devnetAssets.filter((asset) => asset.kind === "official"),
    [devnetAssets]
  );
  const customAssets = useMemo(
    () => devnetAssets.filter((asset) => asset.kind === "custom"),
    [devnetAssets]
  );

  const mintMutation = useMutation({
    mutationFn: async (params: { code: string; amount: number }) =>
      nexusFetch<MintDevnetAssetResponse>(
        "/api/devnet/mint",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        },
        authContext
      ),
    onSuccess: (data) => {
      setSuccessMessage(
        `${data.uiAmount.toLocaleString("en-US")} ${data.asset} minted to ${identity.walletAddress?.slice(0, 10)}...`
      );
      void queryClient.invalidateQueries({
        queryKey: ["devnet-balances", identity.walletAddress],
      });
    },
  });

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">Devnet Token Lab</div>
        <span className="muted-mono" style={{ color: "var(--ink4)", fontSize: "10px" }}>
          Free test assets for testing purposes only. Not redeemable for real value. Do not use on mainnet.
        </span>
      </div>

      <div className="panel-body" style={{ display: "grid", gap: "16px" }}>
        <div style={{ fontSize: "13px", lineHeight: "1.7", color: "var(--ink3)" }}>
          Connect a Solana wallet, request SOL from the public faucet, then use
          Circle&apos;s faucet for official devnet USDC and EURC. The custom
          corridor tokens below can be minted to your connected wallet for free
          inside this app.
        </div>

        <div className="soft-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="wallet-option-name">Connected Wallet Balances</div>
              <div className="wallet-option-desc">
                {identity.walletAddress ??
                  "Connect a wallet to load live devnet balances."}
              </div>
            </div>
            <button
              type="button"
              className="btn-outline"
              onClick={() => void balancesQuery.refetch()}
              disabled={!isLoggedIn || balancesQuery.isFetching}
            >
              {balancesQuery.isFetching ? "Refreshing" : "Refresh Balances"}
            </button>
          </div>

          <div className="detail-grid" style={{ marginTop: "14px" }}>
            <div className="detail-box">
              <div className="detail-box-label">SOL</div>
              <div className="detail-box-val">
                {balancesQuery.data
                  ? balancesQuery.data.sol.amount.toLocaleString("en-US", {
                      maximumFractionDigits: 4,
                    })
                  : "--"}
              </div>
              <div className="detail-box-sub">
                {balancesQuery.data
                  ? `Read via ${balancesQuery.data.rpcUrl}`
                  : "Waiting for live RPC balance"}
              </div>
            </div>
            {devnetAssets.map((asset) => {
              const balance = balancesByCode.get(asset.code);

              return (
                <div key={`balance-${asset.code}`} className="detail-box">
                  <div className="detail-box-label">{asset.code}</div>
                  <div className="detail-box-val">
                    {balance
                      ? balance.uiAmount.toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })
                      : "0"}
                  </div>
                  <div className="detail-box-sub">
                    {balance?.tokenAccounts.length
                      ? `${balance.tokenAccounts.length} token account${balance.tokenAccounts.length === 1 ? "" : "s"}`
                      : "No token account yet"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="comp-list">
          {DEVNET_FAUCET_LINKS.map((link) => (
            <div key={link.code} className="comp-row" style={{ alignItems: "flex-start" }}>
              <div>
                <div className="comp-row-label">{link.label}</div>
                <div style={{ color: "var(--ink4)", fontSize: "11px", marginTop: "4px" }}>
                  {link.description}
                </div>
              </div>
              <a
                className="btn-outline"
                href={link.url}
                target="_blank"
                rel="noreferrer"
                style={{ whiteSpace: "nowrap" }}
              >
                Open Faucet
              </a>
            </div>
          ))}
        </div>

        <div className="detail-grid">
          {officialAssets.map((asset) => (
            <div key={asset.code} className="detail-box">
              {/* <div className="detail-box-label">{asset.code}</div> */}
              {/* <div className="detail-box-val" style={{ color: "var(--accent)" }}>
                {balancesByCode
                  .get(asset.code)
                  ?.uiAmount.toLocaleString("en-US", {
                    maximumFractionDigits: 2,
                  }) ?? "0"}
              </div> */}
              {/* <div className="detail-box-sub">
                {asset.description}
                {asset.faucetUrl ? " Faucet available." : ""}
              </div> */}
              {/* <div className="wallet-address" style={{ marginTop: "12px" }}>
                {asset.mint}
              </div> */}
              {/* {asset.faucetUrl ? (
                <a
                  className="btn-outline"
                  href={asset.faucetUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ marginTop: "12px", display: "inline-flex" }}
                >
                  Open Circle Faucet
                </a>
              ) : null} */}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gap: "12px" }}>
          {customAssets.map((asset) => {
            const amount = amountByCode[asset.code] ?? "10000";
            const isActive =
              mintMutation.isPending && mintMutation.variables?.code === asset.code;
            const balance = balancesByCode.get(asset.code);

            return (
              <div key={asset.code} className="soft-card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "16px",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div className="wallet-option-name">{asset.label}</div>
                    <div className="wallet-option-desc">{asset.description}</div>
                  </div>
                  <span className="badge bg">FREE MINT</span>
                </div>

                <div className="wallet-address" style={{ marginTop: "12px" }}>
                  {asset.mint}
                </div>

                <div style={{ color: "var(--ink4)", fontSize: "11px", marginTop: "8px" }}>
                  Current balance:{" "}
                  {balance
                    ? balance.uiAmount.toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })
                    : "0"}{" "}
                  {asset.code}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                    flexWrap: "wrap",
                    marginTop: "12px",
                  }}
                >
                  <input
                    className="form-input"
                    style={{ maxWidth: "160px" }}
                    value={amount}
                    onChange={(event) =>
                      setAmountByCode((current) => ({
                        ...current,
                        [asset.code]: event.target.value,
                      }))
                    }
                    inputMode="decimal"
                    placeholder="Amount"
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={
                      !isLoggedIn ||
                      isActive ||
                      !Number(amount) ||
                      Number(amount) <= 0
                    }
                    onClick={() => {
                      setSuccessMessage(null);
                      mintMutation.mutate({
                        code: asset.code,
                        amount: Number(amount),
                      });
                    }}
                  >
                    {isActive ? "Minting" : `Mint ${asset.code}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {successMessage ? (
          <div className="info-box">
            <div className="info-box-title">Mint Complete</div>
            <div className="info-box-text">{successMessage}</div>
            {mintMutation.data?.signature ? (
              <a
                href={explorerUrl(mintMutation.data.signature)}
                target="_blank"
                rel="noreferrer"
                className="btn-outline"
                style={{ marginTop: "12px", display: "inline-flex" }}
              >
                View Transaction
              </a>
            ) : null}
          </div>
        ) : null}

        {balancesQuery.error ? (
          <div className="warning-box">
            <div className="warning-box-text">
              {balancesQuery.error instanceof Error
                ? balancesQuery.error.message
                : "Failed to load wallet balances"}
            </div>
          </div>
        ) : null}

        {mintMutation.error ? (
          <div className="warning-box">
            <div className="warning-box-text">
              {mintMutation.error instanceof Error
                ? mintMutation.error.message
                : "Failed to mint devnet tokens"}
            </div>
          </div>
        ) : null}

        <div className="soft-card">
          <div className="wallet-option-name">Create another custom mint</div>
          <div className="wallet-option-desc" style={{ marginTop: "4px" }}>
            Use the included script to create a fresh SPL mint and wire it into
            your env for another test currency.
          </div>
          <div className="wallet-address" style={{ marginTop: "12px" }}>
            npm run devnet:create-mint -- SGDC "Singapore Dollar Coin"
          </div>
          <div style={{ marginTop: "12px" }}>
            <Link href="/fx" className="btn-outline">
              Open FX Venue
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
