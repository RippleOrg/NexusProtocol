<div align="center">

# NEXUS Protocol

**Compliance-native programmable trade settlement and institutional FX venue on Solana**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?logo=solana)](https://solana.com)
[![Anchor](https://img.shields.io/badge/Anchor-0.30.0-512BD4)](https://www.anchor-lang.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript)](https://typescriptlang.org)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Smart Contract](#smart-contract)
  - [Program Instructions](#program-instructions)
  - [On-chain State](#on-chain-state)
  - [Error Handling](#error-handling)
- [Frontend Application](#frontend-application)
  - [Pages & Routes](#pages--routes)
  - [API Endpoints](#api-endpoints)
  - [Components & Hooks](#components--hooks)
- [Compliance Engine](#compliance-engine)
- [Integrations](#integrations)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Running Locally](#running-locally)
- [Smart Contract Development](#smart-contract-development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [Contributing](#contributing)

---

## Overview

NEXUS Protocol is a **compliance-native, programmable trade settlement and institutional FX venue** built on Solana. It enables regulated financial institutions to execute cross-border trades with built-in KYC, AML, and travel-rule compliance enforced atomically at the smart-contract layer — without sacrificing speed or settlement finality.

### Why NEXUS?

Traditional cross-border settlements are slow, opaque, and compliance-heavy. NEXUS collapses the trade lifecycle — from FX quoting to escrow funding to final settlement — into a single atomic Solana transaction, with every compliance check encoded directly in the on-chain program logic.

**Core value propositions:**

| Traditional Settlement | NEXUS Protocol |
|---|---|
| T+2 or T+3 settlement | Sub-second atomic settlement |
| Manual KYC/AML checks | On-chain KYC/AML enforcement |
| Fragmented compliance records | Immutable lineage audit chain |
| Siloed VASP reporting | Automated travel-rule compliance |
| Opaque FX pricing | Transparent RFQ venue with SIX BFI reference rates |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NEXUS Protocol                              │
│                                                                     │
│   ┌──────────────────┐           ┌────────────────────────────┐    │
│   │  Next.js 15 App  │           │   Solana / Anchor Program  │    │
│   │                  │           │                            │    │
│   │  ┌────────────┐  │           │  ┌──────────────────────┐  │    │
│   │  │ Dashboard  │  │◄─────────►│  │  Escrow & Settlement │  │    │
│   │  │ Trades     │  │  @coral/  │  │  KYC Registry        │  │    │
│   │  │ FX Venue   │  │  anchor   │  │  FX Venue (RFQ/AMM)  │  │    │
│   │  │ Compliance │  │           │  │  Collateral Manager  │  │    │
│   │  └────────────┘  │           │  │  Lineage Audit Chain │  │    │
│   │                  │           │  └──────────────────────┘  │    │
│   │  ┌────────────┐  │           │  Program ID:               │    │
│   │  │  API Layer │  │           │  NXSvFss...ARUdGi7Mb       │    │
│   │  │  /api/*    │  │           └────────────────────────────┘    │
│   │  └─────┬──────┘  │                                             │
│   └─────── │ ────────┘                                             │
│             │                                                       │
│    ┌────────┼───────────────────────────────────────────┐          │
│    │        ▼          External Integrations            │          │
│    │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │          │
│    │  │Fireblocks│  │SIX BFI   │  │   Chainalysis    │ │          │
│    │  │MPC Vault │  │FX Rates  │  │   AML Screening  │ │          │
│    │  └──────────┘  └──────────┘  └──────────────────┘ │          │
│    │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │          │
│    │  │ Keyrock  │  │Solstream │  │   PostgreSQL +   │ │          │
│    │  │ Market   │  │On-chain  │  │   Redis Cache    │ │          │
│    │  │ Maker    │  │Events    │  │                  │ │          │
│    │  └──────────┘  └──────────┘  └──────────────────┘ │          │
│    └───────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 🔒 Compliance-First Design
- **On-chain KYC Registry** — Multi-tier KYC (1–3) with expiry and revocation, enforced at the program level
- **AML Screening** — Chainalysis-powered risk scoring; sanctioned addresses are blocked from creating or funding escrows
- **Travel Rule** — Automated VASP-to-VASP reporting for transfers above threshold, with on-chain log PDAs
- **Fund Lineage Audit Chain** — Cryptographic source-of-funds chain linking every on-chain fund movement, inspectable by regulators
- **Know-Your-Transaction (KYT)** — Continuous monitoring of on-chain transaction patterns

### 💱 Institutional FX Venue
- **RFQ (Request-for-Quote)** — KYC tier-2+ institutions post firm quotes; counterparties fill at guaranteed rates
- **AMM Liquidity Pools** — Passive liquidity provision with LP tokens and proportional fee sharing
- **SIX BFI Rate Guard** — FX settlement rates validated against SIX Group's reference rates via mTLS API; deviation above threshold is rejected on-chain
- **Keyrock Integration** — Firm FX quotes from Keyrock market maker for institutional liquidity

### 📦 Programmable Escrow & Settlement
- **Conditional Escrow** — Attach document-hash proofs, oracle values, or time conditions to a trade
- **Atomic Settlement** — Escrow release + FX swap execute in a single Solana transaction
- **Dispute Resolution** — Structured dispute/resolution flow with admin arbitration
- **Auto-Refund** — Funds automatically returnable to importer after configurable expiry

### 🏦 Collateral Management
- **RWA Collateral** — Tokenized precious metals (Gold, Silver, Platinum) from SIX BFI VALOR via the `fund_escrow_with_collateral` instruction
- **LTV Monitoring** — Real-time Loan-to-Value health checks via `check_collateral_health`; automatic liquidation flag when threshold is breached
- **Price Oracle** — SIX BFI prices (scaled 1e8) used on-chain; staleness checks enforce recency

### 🔐 Enterprise Security
- **Fireblocks MPC** — All treasury and vault operations signed via Fireblocks multi-party computation; webhook verification
- **Solstream Compliance Feed** — Real-time on-chain compliance events streamed via WebSocket
- **Role-based Access** — Admin, institution, and market-maker roles enforced at smart-contract level

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Blockchain** | Solana (Devnet / Mainnet) |
| **Smart Contract** | Anchor 0.30.0 (Rust) |
| **Token Standards** | SPL Token, Token-2022 |
| **Frontend** | Next.js 15, React 18, TypeScript 5.3 |
| **Styling** | Tailwind CSS 3.4, Radix UI |
| **State Management** | Zustand, TanStack Query |
| **Forms** | React Hook Form, Zod |
| **Database** | PostgreSQL (Prisma ORM 5.10) |
| **Cache** | Redis (ioredis) |
| **Auth** | NextAuth v4, JWT (jose) |
| **MPC Wallet** | Fireblocks TS SDK 3.0 |
| **AML** | Chainalysis API |
| **FX Rates** | SIX Group BFI (REST + WebSocket mTLS) |
| **Market Maker** | Keyrock API |
| **Event Streaming** | Solstream (WebSocket) |
| **PDF Reports** | PDFKit |
| **Tests** | Mocha, Chai, ts-mocha |

---

## Smart Contract

The on-chain program lives in `programs/nexus/` and is compiled with Anchor 0.30.

**Program ID:** `NXSvFssBwGNZPpPSS5tcMqQLYbFf8yRKXBiARUdGi7Mb`

```
programs/nexus/src/
├── lib.rs                        # Program entry point (25+ instructions)
├── errors.rs                     # Comprehensive error enum (NexusError)
├── events.rs                     # Anchor event definitions
├── instructions/                 # One file per instruction handler
│   ├── initialize_protocol.rs
│   ├── register_institution.rs
│   ├── create_escrow.rs
│   ├── fund_escrow.rs
│   ├── submit_condition.rs
│   ├── execute_settlement.rs
│   ├── dispute_escrow.rs
│   ├── resolve_dispute.rs
│   ├── refund_escrow.rs
│   ├── post_fx_quote.rs
│   ├── cancel_fx_quote.rs
│   ├── add_fx_liquidity.rs
│   ├── remove_fx_liquidity.rs
│   ├── update_kyc_record.rs
│   ├── revoke_kyc_record.rs
│   ├── fund_escrow_with_collateral.rs
│   ├── check_collateral_health.rs
│   ├── liquidate_collateral.rs
│   ├── create_lineage_record.rs
│   └── verify_lineage_chain.rs
├── state/                        # On-chain account state definitions
│   ├── config.rs                 # Protocol-level configuration
│   ├── escrow.rs                 # Escrow, conditions, collateral
│   ├── compliance.rs             # KYC records, lineage chain
│   ├── fx_venue.rs               # RFQ quotes, liquidity pools
│   └── mod.rs
└── utils/                        # Shared utilities
    ├── compliance.rs
    ├── math.rs
    └── fx.rs
```

### Program Instructions

#### Protocol Administration

| Instruction | Description | Signer |
|---|---|---|
| `initialize_protocol` | Bootstrap protocol with fee config, admin, and treasury | Admin |
| `update_kyc_record` | Update institution KYC tier and expiry | Admin |
| `revoke_kyc_record` | Revoke an institution's KYC record | Admin |
| `create_lineage_record` | Record a source-of-funds lineage event | Admin |
| `verify_lineage_chain` | Verify an audit lineage chain for regulators | Admin |

#### Institution Registration

| Instruction | Description | Signer |
|---|---|---|
| `register_institution` | Register institution with KYC tier, VASP ID, and jurisdiction | Admin |

#### Escrow Lifecycle

| Instruction | Description | Signer |
|---|---|---|
| `create_escrow` | Create escrow with trade conditions and compliance checks | Importer |
| `fund_escrow` | Transfer tokens into the PDA vault | Importer |
| `submit_condition` | Submit proof for a trade condition | Importer / Oracle |
| `execute_settlement` | Atomic FX swap + escrow release (all conditions met) | Exporter |
| `dispute_escrow` | Raise a dispute within the dispute window | Importer |
| `resolve_dispute` | Arbitrate and rule on a dispute | Admin |
| `refund_escrow` | Return funds to importer after expiry | Any |

#### Collateral

| Instruction | Description | Signer |
|---|---|---|
| `fund_escrow_with_collateral` | Collateralise escrow with tokenized RWA (precious metals) | Importer |
| `check_collateral_health` | Update price and check LTV; flag for liquidation if threshold breached | Admin/Oracle |
| `liquidate_collateral` | Execute liquidation of flagged collateral | Admin |

#### FX Venue

| Instruction | Description | Signer |
|---|---|---|
| `post_fx_quote` | Post a firm RFQ quote (KYC tier 2+) | Market Maker |
| `cancel_fx_quote` | Cancel an unfilled quote | Market Maker |
| `add_fx_liquidity` | Add tokens to an AMM pool | Liquidity Provider |
| `remove_fx_liquidity` | Withdraw from an AMM pool | Liquidity Provider |

### On-chain State

#### `ProtocolConfig`
Global protocol settings stored in a singleton PDA.
```
admin              Pubkey      # Admin authority
treasury           Pubkey      # Protocol fee recipient
fee_bps            u16         # Settlement fee (basis points)
is_paused          bool        # Circuit breaker
```

#### `EscrowAccount`
Per-trade state machine tracking the full lifecycle of a trade.
```
escrow_id          String      # Unique identifier
importer           Pubkey      # Buyer wallet
exporter           Pubkey      # Seller wallet
deposit_amount     u64         # Locked token amount
token_mint         Pubkey      # Deposited token mint
settlement_mint    Pubkey      # Settlement currency mint
settlement_amount  u64         # Expected settlement amount
fx_rate            u64         # Agreed FX rate
status             EscrowStatus
conditions         Vec<Condition>
collateral         Option<CollateralConfig>
travel_rule_log    Option<Pubkey>
source_of_funds    Option<[u8; 32]>
expires_at         i64
settled_at         Option<i64>
```

**Escrow statuses:** `Created → Funded → ConditionsMet → Settled | Disputed | Refunded`

#### `KycRecord`
On-chain KYC registration for each institution.
```
institution_id     String      # Unique institution identifier
wallet             Pubkey      # Institution wallet
kyc_tier           u8          # 1 = Basic, 2 = Enhanced, 3 = Institutional
jurisdiction       String      # Two-letter country/region code
vasp_id            String      # VASP registration ID
aml_risk_score     u8          # AML risk score (0–100)
expires_at         i64         # KYC expiry timestamp
is_revoked         bool
```

#### `FxQuote`
RFQ quote posted on the FX venue.
```
quote_id           String
market_maker       Pubkey
base_mint          Pubkey
quote_mint         Pubkey
rate               u64         # Scaled rate
amount             u64         # Available notional
expires_at         i64
is_filled          bool
```

#### `LineageRecord`
Immutable fund-lineage node for audit chain.
```
record_id          String
institution_id     String
escrow_id          Option<String>
event_type         LineageEventType
amount             u64
token_mint         Pubkey
source_hash        [u8; 32]    # SHA-256 of source document
prev_record        Option<Pubkey>
transaction_sig    String
attestation        [u8; 64]    # Ed25519 signature
```

#### `CollateralConfig`
Embedded in `EscrowAccount` for precious-metal-backed trades.
```
collateral_mint    Pubkey
collateral_amount  u64         # Raw token units (1e8 = 1 oz)
collateral_type    u8          # 0=Gold, 1=Silver, 2=Platinum
six_bfi_valor_bc   String      # SIX BFI security code
price_at_funding   i64         # Entry price (scaled 1e8)
price_timestamp    i64
ltv_bps            u16         # Loan-to-value ratio (basis points)
liquidation_threshold_bps u16
is_liquidated      bool
```

**SIX BFI VALOR codes:**
- Gold: `274702_148`
- Silver: `274720_148`
- Platinum: `287635_148`

### Error Handling

The `NexusError` enum covers all error conditions with descriptive messages:

| Category | Errors |
|---|---|
| **KYC / Compliance** | `InstitutionNotKyced`, `KycExpired`, `KycTierInsufficient`, `KycRevoked` |
| **AML** | `AmlSanctionsMatch`, `AmlRiskScoreTooHigh`, `AmlCheckRequired` |
| **Escrow Lifecycle** | `EscrowAlreadyFunded`, `EscrowNotFunded`, `EscrowAlreadySettled`, `EscrowExpired`, `EscrowInDispute`, `EscrowNotInDispute`, `InvalidEscrowStatus` |
| **Conditions** | `ConditionAlreadySatisfied`, `ConditionProofInvalid`, `DocumentHashMismatch`, `OracleValueMismatch`, `NotAllConditionsSatisfied`, `DisputeWindowActive/Expired`, `UnauthorizedDispute` |
| **FX / Quotes** | `QuoteExpired`, `QuoteAlreadyFilled`, `RateOutsideBand`, `RateDeviationExceedsSixBfi`, `InsufficientLiquidity`, `SlippageExceeded`, `InvalidFxPair` |
| **Travel Rule** | `TravelRuleThresholdExceeded`, `TravelRuleDataMissing` |
| **Collateral** | `CollateralValueInsufficient`, `CollateralLtvExceeded`, `CollateralPriceStale`, `CollateralAlreadyLiquidated`, `InvalidCollateralMint` |
| **Lineage** | `InvalidLineageChain`, `LineageAttestationMissing` |
| **General** | `Unauthorized`, `InvalidAmount`, `ArithmeticOverflow`, `InvalidTimestamp`, `ProtocolPaused`, `MaxConditionsReached`, `VenueNotActive` |

---

## Frontend Application

The Next.js 15 application provides a full institutional trading interface.

### Pages & Routes

```
app/
├── page.tsx                      # → Redirects to /dashboard
├── layout.tsx                    # Root layout (dark theme, Inter font)
├── dashboard/                    # Main dashboard: FX rates, portfolio metrics
├── trades/
│   ├── page.tsx                  # Trade list & history
│   ├── new/                      # Create new trade / escrow
│   └── [escrowId]/               # Individual trade detail & lifecycle
├── fx/                           # FX venue: RFQ book & liquidity pools
├── compliance/
│   ├── page.tsx                  # Compliance monitoring & alerts
│   └── reports/                  # Audit report generator (PDF export)
├── onboarding/                   # Institution KYC onboarding flow
└── demo/                         # Sandbox demo scenarios
```

### API Endpoints

#### KYC

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/kyc/verify` | Verify and store KYC data for an institution |
| `GET` | `/api/kyc/status` | Check KYC status for a wallet address |

#### AML

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/aml/screen` | Screen a wallet address via Chainalysis |

#### Compliance

| Method | Endpoint | Description |
|---|---|---|
| `WS` | `/api/compliance/events/stream` | Real-time compliance event stream via Solstream |

#### Travel Rule

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/travel-rule/submit` | Submit travel rule VASP report |

#### Audit Reports

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/reports/audit` | Generate and download a PDF audit report |

#### Fireblocks

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/fireblocks/sign` | Sign a transaction via Fireblocks MPC |
| `POST` | `/api/fireblocks/webhook` | Receive and verify Fireblocks webhook events |

#### FX Rates

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/rates` | Fetch current FX rates (SIX BFI + Keyrock) |
| `WS` | `/api/rates/stream` | Real-time rate streaming via WebSocket |

### Components & Hooks

#### React Components (`components/`)

| Component | Description |
|---|---|
| `AuditReportGenerator` | Generate and download PDF compliance audit reports |
| `ComplianceEventFeed` | Real-time feed of on-chain compliance events |
| `FxRatesTicker` | Live FX rate ticker with SIX BFI and Keyrock data |
| `CollateralHealthPanel` | LTV monitoring dashboard for collateralised escrows |
| `CollateralSelector` | Asset picker for tokenized precious metals |

#### Custom Hooks (`hooks/`)

| Hook | Description |
|---|---|
| `useCompliance` | KYC/AML check logic and status |
| `useEscrows` | Escrow creation, funding, and lifecycle management |
| `useFxVenue` | RFQ posting, quote filling, and liquidity operations |
| `useSettlement` | Execute atomic settlement transactions |
| `useSixBfi` | SIX BFI precious metals price feeds |

#### State Stores (`store/`)

| Store | Description |
|---|---|
| `useWalletStore` | Wallet connection, authentication, and session state |
| `useTradeStore` | Active trades, escrow data, and trade history |
| `useComplianceStore` | Compliance check results, AML flags, and KYC status |

---

## Compliance Engine

The compliance module (`lib/compliance/`) provides four distinct enforcement layers:

### KYC — Know Your Customer (`lib/compliance/kyc.ts`)
Verifies institution identity, KYC tier, and expiry before any trade operation. Tiers:
- **Tier 1 (Basic):** Identity verified; limited trade volumes
- **Tier 2 (Enhanced):** Full due diligence; FX venue access
- **Tier 3 (Institutional):** Highest tier; unrestricted access + market-making

### AML — Anti-Money Laundering (`lib/compliance/aml.ts`)
Screens wallet addresses against Chainalysis risk scores and sanctions lists. Returns `CLEAR`, `REVIEW`, or `BLOCK` recommendations. Scores and categories are cached in PostgreSQL.

### KYT — Know Your Transaction (`lib/compliance/kyt.ts`)
Monitors individual transaction patterns for unusual behaviour, high-risk counterparties, or suspicious volume spikes. Risk events are stored and trigger real-time alerts.

### Travel Rule (`lib/compliance/travel-rule.ts`)
Automates VASP-to-VASP data sharing for transfers above the threshold, per FATF Recommendation 16. Originator and beneficiary information is submitted and the on-chain log PDA is created as part of the settlement instruction.

---

## Integrations

### SIX Group BFI (`lib/integrations/six-bfi.ts` & `six-bfi-stream.ts`)
Real-time and historical precious metals pricing from SIX Group via:
- **REST API** (mTLS with client certificate) for on-demand price lookups
- **WebSocket stream** for live price updates

Used by the smart contract to validate that FX rates at settlement don't deviate beyond an allowed band from the reference rate.

Environment variables required:
```env
SIX_CERT_PATH=./certs/signed-certificate.pem
SIX_KEY_PATH=./certs/private-key.pem
SIX_CERT_PASSWORD=sixhackathon2026
```

### Fireblocks MPC (`lib/integrations/fireblocks.ts`)
All protocol treasury operations are signed using Fireblocks multi-party computation:
- Transaction signing for admin operations
- Webhook receiver for async transaction status updates
- Vault ID linked per institution in the database

```env
FIREBLOCKS_API_KEY=...
FIREBLOCKS_API_SECRET_PATH=./fireblocks_secret.key
FIREBLOCKS_BASE_URL=https://api.fireblocks.io
NEXT_PUBLIC_FIREBLOCKS_ENABLED=false
FIREBLOCKS_WEBHOOK_SECRET=...
```

### Chainalysis (`lib/integrations/chainalysis.ts`)
AML risk screening and sanctions checking:
- Risk score (0–10) with category breakdown
- Sanction list matching
- Results cached in PostgreSQL with TTL via Redis

```env
CHAINALYSIS_API_KEY=...
CHAINALYSIS_BASE_URL=https://api.chainalysis.com
```

### Keyrock (`lib/integrations/keyrock.ts`)
Firm FX quotes from the Keyrock market maker:
- Institutional-grade bid/ask spreads
- Used alongside SIX BFI for rate validation

```env
KEYROCK_API_URL=https://api.keyrock.eu
KEYROCK_API_KEY=...
```

### Solstream (`lib/integrations/solstream.ts`)
Real-time on-chain compliance event streaming:
- WebSocket subscription to program account changes
- Parses and forwards compliance-relevant events to the frontend feed

```env
SOLSTREAM_ENDPOINT=wss://stream.solstice.sh/v1/{YOUR_PROGRAM_ID}
SOLSTREAM_API_KEY=...
```

---

## Database Schema

NEXUS uses PostgreSQL via Prisma ORM for off-chain state, compliance records, and analytics.

### `Institution`
```
id                String    @id @default(cuid())
wallet            String    @unique       # Solana wallet pubkey
name              String    @unique       # Matches on-chain institution_id
jurisdiction      String
kycTier           Int                    # 1, 2, or 3
kycVerifiedAt     DateTime?
kycExpiresAt      DateTime?
fireblocksVaultId String?
isActive          Boolean   @default(true)
```

### `Escrow`
```
id                        String    @id @default(cuid())
onChainPda                String    @unique
importerInstitutionId     String
exporterInstitutionId     String
depositAmount             BigInt
tokenMint                 String
settlementMint            String
settlementAmount          BigInt
status                    String
conditionsTotal           Int
fxRate                    BigInt?
travelRuleLogPda          String?
sourceOfFundsHash         String?
expiresAt                 DateTime
settledAt                 DateTime?
```

### `TravelRuleLog`
```
id                        String    @id @default(cuid())
onChainLogPda             String    @unique
escrowId                  String
originatorInstitutionId   String
beneficiaryInstitutionId  String
transferAmount            BigInt
currency                  String
originatorName            String
originatorAccount         String
beneficiaryName           String
beneficiaryAccount        String
```

### `AmlScreening`
```
id                String    @id @default(cuid())
wallet            String
institutionId     String
riskScore         Float                 # 0.0–10.0
isSanctioned      Boolean
riskCategories    String[]
recommendation    String                # CLEAR | REVIEW | BLOCK
provider          String                # CHAINALYSIS
createdAt         DateTime  @default(now())
```

### `KytEvent`
```
id              String    @id @default(cuid())
txHash          String
institutionId   String
riskLevel       String
score           Float
flags           Json
recommendation  String
resolvedAt      DateTime?
createdAt       DateTime  @default(now())
```

---

## Getting Started

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | ≥ 18 | JavaScript runtime |
| Yarn | ≥ 1.22 | Package manager |
| Rust | stable | Anchor program compilation |
| Solana CLI | ≥ 1.18 | Cluster interaction |
| Anchor CLI | 0.30.0 | Smart contract build/deploy/test |
| PostgreSQL | ≥ 14 | Off-chain database |
| Redis | ≥ 7 | Cache layer |

Install Anchor CLI:
```bash
cargo install --git https://github.com/coral-xyz/anchor avm --force
avm install 0.30.0
avm use 0.30.0
```

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/RippleOrg/NexusProtocol.git
cd NexusProtocol

# 2. Install Node.js dependencies
yarn install

# 3. Install Rust / Anchor dependencies (compiles the on-chain program)
anchor build
```

### Environment Variables

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env.local
```

#### Solana
```env
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_NEXUS_PROGRAM_ID=NXSvFssBwGNZPpPSS5tcMqQLYbFf8yRKXBiARUdGi7Mb
NEXT_PUBLIC_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
NEXT_PUBLIC_NETWORK=devnet
```

#### Protocol Wallets
```env
NEXUS_TREASURY_WALLET=<treasury_pubkey>
NEXUS_ADMIN_WALLET=<admin_pubkey>
NEXUS_ADMIN_SECRET_KEY=<base58_encoded_64_byte_keypair>
```

#### Database & Cache
```env
DATABASE_URL=postgresql://nexus:password@localhost:5432/nexus_db
REDIS_URL=redis://localhost:6379
```

#### Authentication
```env
NEXTAUTH_SECRET=<random_secret>
NEXTAUTH_URL=http://localhost:3000
JWT_SECRET=<random_jwt_secret>
```

#### SIX Group BFI (mTLS)
```env
SIX_CERT_PATH=./certs/signed-certificate.pem
SIX_KEY_PATH=./certs/private-key.pem
SIX_CERT_PASSWORD=sixhackathon2026
```

#### Fireblocks MPC
```env
FIREBLOCKS_API_KEY=<api_key>
FIREBLOCKS_API_SECRET_PATH=./fireblocks_secret.key
FIREBLOCKS_BASE_URL=https://api.fireblocks.io
NEXT_PUBLIC_FIREBLOCKS_ENABLED=false
FIREBLOCKS_WEBHOOK_SECRET=<webhook_secret>
```

#### Chainalysis AML
```env
CHAINALYSIS_API_KEY=<api_key>
CHAINALYSIS_BASE_URL=https://api.chainalysis.com
```

#### Keyrock
```env
KEYROCK_API_URL=https://api.keyrock.eu
KEYROCK_API_KEY=<api_key>
```

#### Solstream
```env
SOLSTREAM_ENDPOINT=wss://stream.solstice.sh/v1/NXSvFssBwGNZPpPSS5tcMqQLYbFf8yRKXBiARUdGi7Mb
SOLSTREAM_API_KEY=<api_key>
```

### Database Setup

```bash
# Generate Prisma client
yarn db:generate

# Push schema to a fresh database (development)
yarn db:push

# Or run migrations (staging / production)
yarn db:migrate
```

### Running Locally

```bash
# Start the Next.js development server
yarn dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

---

## Smart Contract Development

### Build

```bash
# Compile the Anchor program
yarn anchor:build
# or
anchor build
```

The compiled program binary and IDL are emitted to `target/`.

### Local Validator

```bash
# Start a local Solana test validator with the program deployed
anchor localnet
```

### Deploy to Devnet

```bash
# Ensure your Solana CLI is pointed at devnet
solana config set --url devnet

# Deploy the compiled program
anchor deploy
```

### IDL

The Anchor IDL is automatically generated during `anchor build` and placed at:
```
target/idl/nexus.json
target/types/nexus.ts
```

---

## Testing

### Smart Contract Tests (Anchor / TypeScript)

```bash
# Run all Anchor tests against a local validator
yarn anchor:test
# or
anchor test
```

Tests are in `tests/nexus.ts` and cover:
- Protocol initialization
- Institution registration and KYC
- Escrow creation, funding, and condition submission
- Atomic settlement execution
- Dispute and refund flows
- Collateral funding and LTV health checks
- Lineage record creation and chain verification

### TypeScript Unit Tests

```bash
yarn test
```

Uses `ts-mocha` + Chai for assertion-style tests.

### Linting

```bash
yarn lint
```

---

## Deployment

### Production Checklist

- [ ] Deploy Solana program to mainnet-beta with a new keypair
- [ ] Update `NEXT_PUBLIC_NEXUS_PROGRAM_ID` with the mainnet program ID
- [ ] Set `NEXT_PUBLIC_NETWORK=mainnet-beta`
- [ ] Configure Fireblocks vaults for treasury and admin wallets
- [ ] Set `NEXT_PUBLIC_FIREBLOCKS_ENABLED=true`
- [ ] Provision a production PostgreSQL instance and run `yarn db:migrate`
- [ ] Provision a Redis cluster for caching
- [ ] Upload SIX BFI mTLS certificates to production environment
- [ ] Configure Chainalysis API key for production AML screening
- [ ] Set up Solstream subscription for the mainnet program
- [ ] Configure `NEXTAUTH_URL` to the production domain
- [ ] Deploy the Next.js app (Vercel, AWS, or self-hosted)

### Build for Production

```bash
yarn build
yarn start
```

---

## Security

### On-chain Security Model
- All privileged operations (KYC updates, dispute resolution, liquidation) require the `admin` signer
- KYC tier checks are enforced at instruction entry — no tier-gating can be bypassed
- AML sanctions matching blocks any sanctioned wallet from creating or funding escrows
- FX rate deviation from SIX BFI reference is rejected with `RateDeviationExceedsSixBfi`
- Collateral price staleness prevents exploitation of stale oracle data
- Arithmetic operations use checked arithmetic with `ArithmeticOverflow` errors

### Secrets Management
- Never commit `.env` files or private keys to source control
- Fireblocks MPC eliminates single-key risk for treasury operations
- Admin secret key (`NEXUS_ADMIN_SECRET_KEY`) should be stored in a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.) in production

### Reporting Vulnerabilities
Please report security vulnerabilities privately by opening a [GitHub Security Advisory](https://github.com/RippleOrg/NexusProtocol/security/advisories/new).

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and add tests
4. Run the full test suite: `yarn anchor:test && yarn test`
5. Lint your code: `yarn lint`
6. Open a pull request against `main`

---

<div align="center">

Built with ❤️ by the Ripple team · Powered by [Solana](https://solana.com) · Secured by [Fireblocks](https://fireblocks.com)

</div>
