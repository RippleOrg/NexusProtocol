"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  Building2,
  FileBadge2,
  Hexagon,
  LayoutDashboard,
  Menu,
  PanelTop,
  ShieldCheck,
  X,
} from "lucide-react";
import { useNexusSession } from "@/hooks/useNexusSession";

const NAV_GROUPS = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/trades", label: "Active Trades", icon: ArrowLeftRight },
      { href: "/trades/new", label: "New Escrow", icon: PanelTop },
    ],
  },
  {
    label: "Market",
    items: [{ href: "/fx", label: "FX Venue", icon: Activity }],
  },
  {
    label: "Compliance",
    items: [
      { href: "/compliance", label: "Compliance Hub", icon: ShieldCheck },
      { href: "/compliance/reports", label: "Audit Reports", icon: FileBadge2 },
    ],
  },
];

function getPageMeta(pathname: string) {
  if (pathname === "/dashboard") {
    return { eyebrow: "Overview", title: "Dashboard" };
  }

  if (pathname === "/trades/new") {
    return { eyebrow: "New Trade", title: "New Trade Escrow" };
  }

  if (pathname.startsWith("/trades/")) {
    return { eyebrow: "Trades", title: "Settlement Instruction" };
  }

  if (pathname === "/trades") {
    return { eyebrow: "Trades", title: "Active Trades" };
  }

  if (pathname === "/fx") {
    return { eyebrow: "Market", title: "FX Venue" };
  }

  if (pathname === "/compliance/reports") {
    return { eyebrow: "Reports", title: "Audit Reports" };
  }

  if (pathname === "/compliance") {
    return { eyebrow: "Compliance", title: "Compliance Hub" };
  }

  return { eyebrow: "Workspace", title: "Nexus Protocol" };
}

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  onClick,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  pathname: string;
  onClick?: () => void;
}) {
  const active =
    pathname === href ||
    (href === "/trades" &&
      pathname.startsWith("/trades/") &&
      !pathname.startsWith("/trades/new")) ||
    (href === "/compliance" &&
      pathname.startsWith("/compliance/") &&
      pathname !== "/compliance/reports");

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`app-nav-item ${active ? "is-active" : ""}`}
    >
      <Icon className="app-nav-icon" />
      <span>{label}</span>
      {href === "/trades" ? <span className="app-nav-badge">LIVE</span> : null}
      {href === "/compliance" ? (
        <span className="app-nav-badge">1</span>
      ) : null}
    </Link>
  );
}

function SidebarContent({
  pathname,
  onNavigate,
  institutionName,
  institutionJurisdiction,
  institutionTier,
  walletAddress,
  openWalletLinkFlow,
  logout,
}: {
  pathname: string;
  onNavigate?: () => void;
  institutionName: string;
  institutionJurisdiction: string;
  institutionTier: number;
  walletAddress: string | null;
  openWalletLinkFlow: () => void;
  logout: () => void;
}) {
  return (
    <>
      <div className="app-logo-wrap">
        <Link href="/dashboard" className="app-logo" onClick={onNavigate}>
          <div className="app-logo-mark">
            <Hexagon />
          </div>
          <div className="app-logo-name">
            NEX<span>US</span>
          </div>
        </Link>
      </div>

      <div className="app-nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="app-nav-section">{group.label}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                pathname={pathname}
                onClick={onNavigate}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="app-sidebar-footer">
        <div className="app-inst-card">
          <div className="app-inst-name">{institutionName}</div>
          <div className="app-inst-id">
            {institutionJurisdiction} · Tier {institutionTier}
          </div>
          <div className="app-inst-status">
            <div className="app-status-dot" />
            <div className="app-status-text">KYC ACTIVE</div>
          </div>
          <div className="wallet-address" style={{ marginTop: "10px" }}>
            {walletAddress ?? "Wallet pending"}
          </div>
          <div
            style={{
              display: "grid",
              gap: "8px",
              marginTop: "10px",
              gridTemplateColumns: "1fr 1fr",
            }}
          >
            <button type="button" className="btn-outline" onClick={openWalletLinkFlow}>
              Wallets
            </button>
            <button type="button" className="btn-outline" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function RootShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const {
    sdkHasLoaded,
    isLoggedIn,
    institution,
    identity,
    linkedWallets,
    openAuthFlow,
    openWalletLinkFlow,
    logout,
  } = useNexusSession();

  const isOnboardingRoute = pathname.startsWith("/onboarding");
  const isPublicRoute = pathname === "/";
  const needsOnboarding =
    isLoggedIn && sdkHasLoaded && !institution?.onboardingCompletedAt;
  const pageMeta = getPageMeta(pathname);

  useEffect(() => {
    if (!sdkHasLoaded) {
      return;
    }

    if (!isLoggedIn && !isOnboardingRoute && !isPublicRoute) {
      router.replace("/onboarding/path");
      return;
    }

    if (needsOnboarding && !isOnboardingRoute && !isPublicRoute) {
      router.replace("/onboarding/path");
      return;
    }

    if (isLoggedIn && institution?.onboardingCompletedAt && isOnboardingRoute) {
      router.replace("/dashboard");
    }
  }, [
    institution?.onboardingCompletedAt,
    isLoggedIn,
    isOnboardingRoute,
    isPublicRoute,
    needsOnboarding,
    router,
    sdkHasLoaded,
  ]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (isOnboardingRoute || isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      {mobileOpen ? (
        <button
          type="button"
          className="app-sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside className={`app-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <SidebarContent
          pathname={pathname}
          onNavigate={() => setMobileOpen(false)}
          institutionName={institution?.name ?? identity.displayName ?? "Institution"}
          institutionJurisdiction={institution?.jurisdiction ?? "Pending"}
          institutionTier={institution?.kycTier ?? 0}
          walletAddress={identity.walletAddress}
          openWalletLinkFlow={openWalletLinkFlow}
          logout={logout}
        />
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              className="app-mobile-menu-button"
              onClick={() => setMobileOpen((current) => !current)}
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            >
              {mobileOpen ? <X size={16} /> : <Menu size={16} />}
            </button>

            <div>
              <div className="app-topbar-kicker">{pageMeta.eyebrow}</div>
              <div className="app-page-title">{pageMeta.title}</div>
            </div>
          </div>

          <div className="app-topbar-right">
            <div className="six-pill">SIX BFI · BC=148</div>
            <div className="live-pill">
              <div className="live-dot" />
              STREAM LIVE
            </div>

            {isLoggedIn ? (
              <button
                type="button"
                className="topbar-user"
                onClick={openWalletLinkFlow}
              >
                <span className="topbar-user-badge">
                  <Building2 size={14} />
                </span>
                <span className="topbar-user-copy">
                  <span className="topbar-user-title">
                    {institution?.name ?? identity.displayName ?? "Operator"}
                  </span>
                  <span className="topbar-user-sub">
                    {identity.email ??
                      `${linkedWallets?.length ?? 0} linked wallet${linkedWallets?.length === 1 ? "" : "s"}`}
                  </span>
                </span>
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={openAuthFlow}>
                Sign in
              </button>
            )}
          </div>
        </header>

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
