import Link from "next/link";
import { ArrowRight, Check, Hexagon } from "lucide-react";

const TICKER_ITEMS = [
  { pair: "USD/NGN", rate: "1,583.40", change: "+0.12%", direction: "up", source: "199113_148" },
  { pair: "GBP/NGN", rate: "2,014.20", change: "+0.08%", direction: "up", source: "282981_148" },
  { pair: "USD/KES", rate: "129.45", change: "-0.03%", direction: "dn", source: "275141_148" },
  { pair: "GBP/KES", rate: "164.80", change: "+0.14%", direction: "up", source: "199615_148" },
  { pair: "USD/GHS", rate: "15.82", change: "-0.07%", direction: "dn", source: "3206444_148" },
  { pair: "EUR/USD", rate: "1.0847", change: "+0.05%", direction: "up", source: "946681_148" },
  { pair: "XAU/USD", rate: "2,318.40", change: "+0.34%", direction: "up", source: "274702_148" },
  { pair: "XAG/USD", rate: "27.14", change: "-0.18%", direction: "dn", source: "274720_148" },
];

const FEATURES = [
  {
    icon: "A",
    tone: "blue",
    title: "Atomic Settlement",
    description:
      "Escrow release and FX conversion execute in a single Solana transaction. If either fails, both revert.",
  },
  {
    icon: "S",
    tone: "green",
    title: "Compliance-Native",
    description:
      "KYC, KYT, AML, and Travel Rule controls are enforced at the protocol layer before funds move.",
  },
  {
    icon: "R",
    tone: "amber",
    title: "SIX BFI Live Rates",
    description:
      "Reference FX pricing and rate-band checks are streamed into the settlement flow for corridor protection.",
  },
  {
    icon: "F",
    tone: "blue",
    title: "Fireblocks Integration",
    description:
      "MPC wallet co-signing can be applied above configurable thresholds without changing the operator workflow.",
  },
  {
    icon: "V",
    tone: "green",
    title: "Institutional FX Venue",
    description:
      "Nexus pairs programmable trade settlement with an on-chain institutional venue for corridor execution.",
  },
  {
    icon: "T",
    tone: "amber",
    title: "Regulatory Audit Trail",
    description:
      "Generate source-of-funds lineage and signed regulatory reports from persisted application and on-chain records.",
  },
];

const STEPS = [
  {
    title: "Both parties are verified",
    description:
      "Institutions complete onboarding and attach a wallet, KYC tier, and Travel Rule identity before operating.",
  },
  {
    title: "Escrow terms are encoded",
    description:
      "Trade conditions, source-of-funds evidence, and expiry controls are stored with the live instruction.",
  },
  {
    title: "Compliance gates execute",
    description:
      "AML screening, Travel Rule routing, and rate-band protection are checked before settlement is released.",
  },
  {
    title: "Settlement finalizes atomically",
    description:
      "Escrow release and FX execution complete in a single boundary with no operational exposure gap.",
  },
];

const PARTNERS = [
  "AMINA BANK",
  "SOLANA FOUNDATION",
  "SIX BFI",
  "FIREBLOCKS",
  "KEYROCK",
  "UBS TRADE FINANCE",
  "SOLSTICE",
  "SOFTSTACK",
];

function NexusMark() {
  return <Hexagon />;
}

function TickerRow() {
  return (
    <>
      <div className="lp-tick-live">
        <span className="live-dot" />
        SIX BFI LIVE
      </div>
      {TICKER_ITEMS.map((item) => (
        <div key={`${item.pair}-${item.source}`} className="lp-tick">
          <span className="lp-tick-pair">{item.pair}</span>
          <span className="lp-tick-rate">{item.rate}</span>
          <span className={`lp-tick-chg ${item.direction}`}>{item.change}</span>
          <span className="lp-tick-src">{item.source}</span>
        </div>
      ))}
    </>
  );
}

export default function HomePage() {
  return (
    <div className="page page-landing">
      <nav className="lp-nav">
        <div className="lp-logo">
          <div className="lp-logo-mark">
            <NexusMark />
          </div>
          <div className="lp-logo-name">
            NEX<span>US</span>
          </div>
        </div>

        <div className="lp-nav-links">
          <a className="lp-nav-link" href="#protocol">
            Protocol
          </a>
          <a className="lp-nav-link" href="#compliance">
            Compliance
          </a>
          <a className="lp-nav-link" href="#venue">
            FX Venue
          </a>
          <a className="lp-nav-link" href="#developers">
            Developers
          </a>
        </div>

        <div className="lp-nav-cta">
          <a className="btn-outline" href="#developers">
            Documentation
          </a>
          <Link className="btn-primary btn-primary-blue" href="/onboarding/path">
            Launch App
            <ArrowRight size={14} />
          </Link>
        </div>
      </nav>

      <section className="lp-hero">
        <div className="lp-hero-bg" />
        <div className="lp-hero-grid" />

        <div className="lp-kicker">
          <span className="live-dot" />
          Live on Solana Devnet · SIX BFI integrated
        </div>

        <h1 className="lp-hero-title">
          Trade finance.
          <br />
          <em>Finally compliant.</em>
        </h1>

        <p className="lp-hero-sub">
          NEXUS is the institutional-grade programmable trade settlement
          protocol, combining programmable escrow, an on-chain FX venue, and a
          compliance-native operating layer on Solana.
        </p>

        <div className="lp-hero-actions">
          <Link className="btn-primary btn-primary-blue btn-hero" href="/onboarding/path">
            Get Started
            <ArrowRight size={16} />
          </Link>
          <a className="btn-outline btn-hero" href="#protocol">
            View Documentation
          </a>
        </div>

        <div className="lp-hero-meta">
          Built for AMINA Bank · Solana Foundation StableHacks 2026 · SIX BFI
          partner
        </div>
      </section>

      <div className="lp-ticker">
        <div className="lp-ticker-inner">
          <TickerRow />
          <TickerRow />
        </div>
      </div>

      <div id="protocol">
        <section className="lp-section">
          <div className="lp-section-kicker">Core Architecture</div>
          <div className="lp-section-title">
            Compliance is not a
            <br />
            checkbox. It&apos;s the protocol.
          </div>
          <div className="lp-section-sub">
            Every institution, instruction, and execution path is shaped around
            the same control layer that powers the app.
          </div>

          <div className="features-grid">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="feat-card">
                <div className={`feat-icon ${feature.tone}`}>{feature.icon}</div>
                <div className="feat-title">{feature.title}</div>
                <div className="feat-desc">{feature.description}</div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="lp-stats">
        <div className="lp-stats-inner">
          <div className="lp-stat">
            <div className="lp-stat-val">
              <em>387</em>ms
            </div>
            <div className="lp-stat-lbl">avg settlement time</div>
          </div>
          <div className="lp-stat">
            <div className="lp-stat-val">
              $<em>8.7</em>M
            </div>
            <div className="lp-stat-lbl">30-day volume</div>
          </div>
          <div className="lp-stat">
            <div className="lp-stat-val">
              <em>100</em>%
            </div>
            <div className="lp-stat-lbl">travel rule coverage</div>
          </div>
          <div className="lp-stat">
            <div className="lp-stat-val">
              $<em>284</em>k
            </div>
            <div className="lp-stat-lbl">saved vs SWIFT baseline</div>
          </div>
        </div>
      </div>

      <div id="compliance">
        <section className="lp-section">
          <div className="lp-section-kicker">How It Works</div>
          <div className="lp-section-title">
            Six banks. Twenty documents.
            <br />
            One transaction.
          </div>

          <div className="how-grid">
            <div className="how-steps">
              {STEPS.map((step, index) => (
                <div
                  key={step.title}
                  className={`how-step ${index === 0 ? "active-step" : ""}`}
                >
                  <div className="how-num">{index + 1}</div>
                  <div>
                    <div className="how-step-title">{step.title}</div>
                    <div className="how-step-desc">{step.description}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="how-visual">
              <div className="how-vis-label">Live Settlement Demo</div>
              <div className="settlement-demo">
                {[
                  "KYC verified for both institutions",
                  "Travel Rule payload attached",
                  "AML screen cleared",
                  "SIX BFI rate within band",
                  "Atomic swap executed",
                ].map((item) => (
                  <div key={item} className="sd-row">
                    <span>{item}</span>
                    <div className="sd-check">
                      <Check />
                    </div>
                  </div>
                ))}
                <div className="sd-timer">
                  387<span style={{ fontSize: "14px", color: "var(--green-500)" }}>ms</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div
        id="venue"
        style={{
          background: "var(--stone-50)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          padding: "40px 48px",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div className="lp-section-kicker" style={{ marginBottom: "20px" }}>
            Ecosystem Partners
          </div>
          <div className="partners-row">
            {PARTNERS.map((partner) => (
              <div key={partner} className="partner-badge">
                {partner}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div id="developers" className="lp-cta">
        <div className="lp-cta-title">
          Ready to settle
          <br />
          in <em>400ms?</em>
        </div>
        <div className="lp-cta-sub">
          Set up your institution in minutes with wallet access, compliance
          controls, and reporting rails already wired into the application.
        </div>
        <Link
          className="btn-primary btn-hero"
          href="/onboarding/path"
          style={{ background: "var(--blue-600)", padding: "14px 36px", fontSize: "16px" }}
        >
          Launch App
          <ArrowRight size={16} />
        </Link>
      </div>

      <footer className="lp-footer">
        <div className="lp-footer-copy">
          © 2026 NEXUS PROTOCOL · BUILT ON SOLANA · SIX BFI DATA
        </div>
        <div className="lp-footer-links">
          <a className="lp-footer-link" href="#protocol">
            Privacy
          </a>
          <a className="lp-footer-link" href="#protocol">
            Terms
          </a>
          <a className="lp-footer-link" href="#developers">
            Developers
          </a>
        </div>
      </footer>
    </div>
  );
}
