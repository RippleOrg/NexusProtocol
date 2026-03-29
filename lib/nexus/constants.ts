export const PROGRAM_ID =
  process.env.NEXT_PUBLIC_NEXUS_PROGRAM_ID ??
  "3GapkzNSKXUgtjLXh4wSuWQBA13EwQSzTRNiDwcpFBp7";

export const PUBLIC_DEVNET_RPC_URL = "https://api.devnet.solana.com";

export const ALCHEMY_SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC_URL ??
  process.env.ALCHEMY_SOLANA_RPC_URL ??
  (process.env.ALCHEMY_SOLANA_API_KEY || process.env.ALCHEMY_API_KEY
    ? `https://solana-devnet.g.alchemy.com/v2/${
        process.env.ALCHEMY_SOLANA_API_KEY ?? process.env.ALCHEMY_API_KEY
      }`
    : null);

export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  ALCHEMY_SOLANA_RPC_URL ??
  PUBLIC_DEVNET_RPC_URL;

export const SOLANA_READ_RPC_URLS = Array.from(
  new Set(
    [
      ALCHEMY_SOLANA_RPC_URL,
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
      process.env.SOLANA_RPC_URL,
      PUBLIC_DEVNET_RPC_URL,
    ].filter((value): value is string => Boolean(value))
  )
);

export const OFFICIAL_CIRCLE_DEVNET_USDC_MINT =
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export const OFFICIAL_CIRCLE_DEVNET_EURC_MINT =
  "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr";

export const USDC_MINT =
  process.env.NEXT_PUBLIC_USDC_MINT ??
  OFFICIAL_CIRCLE_DEVNET_USDC_MINT;

export const EURC_MINT =
  process.env.NEXT_PUBLIC_EURC_MINT ??
  OFFICIAL_CIRCLE_DEVNET_EURC_MINT;

export const SUPPORTED_SETTLEMENT_INSTRUMENTS = [
  {
    code: "NGNC",
    label: "Nigerian Naira Coin",
    pair: "USDNGN",
    pairLabel: "USDC / NGNC",
    valorBc: "199113_148",
    settlementMint:
      process.env.NEXT_PUBLIC_NGNC_MINT ??
      "ACr41zznMgboQtZZZCxKovtXDbhThwGsyArP665FR3FE",
  },
  {
    code: "KESC",
    label: "Kenyan Shilling Coin",
    pair: "USDKES",
    pairLabel: "USDC / KESC",
    valorBc: "275141_148",
    settlementMint:
      process.env.NEXT_PUBLIC_KESC_MINT ??
      "HMZzbKpg4zx8WugM4wJBTppfCzpGVvtzXNRgcczQMQXY",
  },
  {
    code: "GHSC",
    label: "Ghana Cedi Coin",
    pair: "USDGHS",
    pairLabel: "USDC / GHSC",
    valorBc: "3206444_148",
    settlementMint:
      process.env.NEXT_PUBLIC_GHSC_MINT ??
      "ApoxiRczs86u8Aa4QycxjKEzMU6nZy4LuYQrvKKs9bh6",
  },
  {
    code: "EURC",
    label: "Euro Coin",
    pair: "EURUSD",
    pairLabel: "USDC / EURC",
    valorBc: "946681_148",
    settlementMint: EURC_MINT,
  },
  {
    code: "GBPC",
    label: "British Pound Coin",
    pair: "GBPUSD",
    pairLabel: "USDC / GBPC",
    valorBc: "275017_148",
    settlementMint:
      process.env.NEXT_PUBLIC_GBPC_MINT ??
      "2heB7u3VKeDmWfqj1ztfV6mxUuyYhhQXBPRjyk847JH8",
  },
] as const;

export function getSettlementInstrumentByCode(code: string) {
  return (
    SUPPORTED_SETTLEMENT_INSTRUMENTS.find(
      (instrument) => instrument.code === code
    ) ?? null
  );
}

export function getSettlementInstrumentByMint(mint: string) {
  return (
    SUPPORTED_SETTLEMENT_INSTRUMENTS.find(
      (instrument) => instrument.settlementMint === mint
    ) ?? null
  );
}

export const COLLATERAL_INSTRUMENTS = [
  {
    code: "XAU",
    label: "Gold 1 Oz",
    valorBc: "274702_148",
    pairLabel: "XAU / USD",
  },
  {
    code: "XAG",
    label: "Silver 1 Oz",
    valorBc: "274720_148",
    pairLabel: "XAG / USD",
  },
  {
    code: "XPT",
    label: "Platinum 1 Oz",
    valorBc: "287635_148",
    pairLabel: "XPT / USD",
  },
] as const;

export const DEVNET_FAUCET_LINKS = [
  {
    code: "SOL",
    label: "Solana Devnet SOL",
    description: "Use the public SOL faucet before minting or sending SPL tokens.",
    url: "https://faucet.solana.com/",
  },
  {
    code: "USDC",
    label: "Circle USDC Faucet",
    description: "Official Circle devnet faucet for Solana USDC.",
    url: "https://faucet.circle.com/",
  },
  {
    code: "EURC",
    label: "Circle EURC Faucet",
    description: "Official Circle devnet faucet for Solana EURC.",
    url: "https://faucet.circle.com/",
  },
] as const;

export const DEVNET_TEST_ASSETS = [
  {
    code: "USDC",
    label: "USDC",
    mint: USDC_MINT,
    kind: "official",
    description: "Official Circle Solana devnet USDC.",
    faucetUrl: "https://faucet.circle.com/",
    mintableInApp: false,
  },
  {
    code: "EURC",
    label: "EURC",
    mint: EURC_MINT,
    kind: "official",
    description: "Official Circle Solana devnet EURC.",
    faucetUrl: "https://faucet.circle.com/",
    mintableInApp: false,
  },
  {
    code: "NGNC",
    label: "Nigerian Naira Coin",
    mint:
      process.env.NEXT_PUBLIC_NGNC_MINT ??
      "ACr41zznMgboQtZZZCxKovtXDbhThwGsyArP665FR3FE",
    kind: "custom",
    description: "Custom devnet settlement mint for NGN corridor testing.",
    mintableInApp: true,
  },
  {
    code: "KESC",
    label: "Kenyan Shilling Coin",
    mint:
      process.env.NEXT_PUBLIC_KESC_MINT ??
      "HMZzbKpg4zx8WugM4wJBTppfCzpGVvtzXNRgcczQMQXY",
    kind: "custom",
    description: "Custom devnet settlement mint for KES corridor testing.",
    mintableInApp: true,
  },
  {
    code: "GHSC",
    label: "Ghana Cedi Coin",
    mint:
      process.env.NEXT_PUBLIC_GHSC_MINT ??
      "ApoxiRczs86u8Aa4QycxjKEzMU6nZy4LuYQrvKKs9bh6",
    kind: "custom",
    description: "Custom devnet settlement mint for GHS corridor testing.",
    mintableInApp: true,
  },
  {
    code: "GBPC",
    label: "British Pound Coin",
    mint:
      process.env.NEXT_PUBLIC_GBPC_MINT ??
      "2heB7u3VKeDmWfqj1ztfV6mxUuyYhhQXBPRjyk847JH8",
    kind: "custom",
    description: "Custom devnet settlement mint for GBP corridor testing.",
    mintableInApp: true,
  },
] as const;

export function getDevnetTestAssetByCode(code: string) {
  return DEVNET_TEST_ASSETS.find((asset) => asset.code === code) ?? null;
}

export const ENTITY_TYPES = [
  "Bank",
  "Licensed Fintech",
  "Broker-Dealer",
  "Commodity Trader",
] as const;

export const TRAVEL_RULE_PROTOCOLS = ["TRISA", "OpenVASP", "SYGNA"] as const;

export const JURISDICTIONS = [
  { code: "CH", name: "Switzerland" },
  { code: "NG", name: "Nigeria" },
  { code: "KE", name: "Kenya" },
  { code: "GH", name: "Ghana" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "SG", name: "Singapore" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "ZA", name: "South Africa" },
] as const;
