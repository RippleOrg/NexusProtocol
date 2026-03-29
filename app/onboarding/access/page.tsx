"use client";

import { useState } from "react";
import {
  BadgeCheck,
  KeyRound,
  LogOut,
  Wallet,
} from "lucide-react";
import { useNexusSession } from "@/hooks/useNexusSession";

export default function OnboardingAccessPage() {
  const {
    identity,
    isLoggedIn,
    linkedWallets,
    openWalletLinkFlow,
    logout,
    sdkHasLoaded,
  } = useNexusSession();
  const [walletMessage, setWalletMessage] = useState<string | null>(null);

  const walletReady = Boolean(identity.walletAddress);
  const linkedWalletCount = linkedWallets.length;
  const activeWallet = linkedWallets[0]?.walletName ?? "Solana wallet";

  function connectWallet() {
    setWalletMessage(
      walletReady
        ? "Opening the wallet selector so you can switch wallets."
        : "Opening the wallet selector. Connect a Solana wallet to continue."
    );
    openWalletLinkFlow();
  }

  return (
    <div>
      <div className="ob-page-title">Authenticate and connect wallet</div>
      <div className="ob-page-sub">
        Connect the Solana wallet your institution will use on devnet. This
        wallet becomes the primary settlement address for onboarding and trade
        creation.
      </div>

      <div className="form-section">
        <div className="form-section-title">Wallet Access</div>

        <div className="soft-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            <div>
              <div className="wallet-option-name">Connect a Solana wallet</div>
            </div>
            <div className="app-logo-mark">
              <KeyRound size={14} />
            </div>
          </div>

          <div className="subtle-panel">
            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                marginBottom: "16px",
              }}
            >
              <button
                type="button"
                className="btn-primary"
                onClick={connectWallet}
              >
                <Wallet size={16} />
                {walletReady ? "Switch wallet" : "Connect wallet"}
              </button>

              {isLoggedIn ? (
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => void logout()}
                >
                  <LogOut size={16} />
                  Disconnect
                </button>
              ) : null}
            </div>

            <div className="wallet-option-desc">
              Session status:{" "}
              {sdkHasLoaded
                ? isLoggedIn
                  ? `authenticated via ${activeWallet}`
                  : "awaiting wallet connection"
                : "loading wallet connector"}
            </div>
          </div>
        </div>

        <div className="wallet-address">
          {identity.walletAddress ?? "No wallet attached yet"}
          <br />
          <span style={{ color: "var(--ink4)" }}>
            {linkedWalletCount} connected wallet
            {linkedWalletCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="onboarding-grid-3">
        <div className="risk-card">
          <div className="risk-card-label">Session</div>
          <div className="risk-card-val green">
            {sdkHasLoaded ? (isLoggedIn ? "ACTIVE" : "PENDING") : "LOADING"}
          </div>
        </div>
        <div className="risk-card">
          <div className="risk-card-label">Wallet Ready</div>
          <div className="risk-card-val blue">{walletReady ? "YES" : "NO"}</div>
        </div>
        <div className="risk-card">
          <div className="risk-card-label">Wallet Type</div>
          <div className="risk-card-val">{walletReady ? activeWallet : "NONE"}</div>
        </div>
      </div>

      {walletReady ? (
        <div className="verify-badge">
          <div className="verify-icon">
            <BadgeCheck size={10} color="#fff" />
          </div>
          <div>
            <div className="verify-text">Primary wallet attached and ready</div>
            <div className="verify-sub">
              This operator can continue to the institution profile step.
            </div>
          </div>
        </div>
      ) : null}

      {walletMessage ? (
        <div className="info-box" style={{ marginTop: "16px" }}>
          <div className="info-box-title">Wallet Status</div>
          <div className="info-box-text">{walletMessage}</div>
        </div>
      ) : null}
    </div>
  );
}
