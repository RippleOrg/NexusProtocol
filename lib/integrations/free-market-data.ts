type CurrencyRates = Record<string, number>;
type MetalRates = Record<string, { price: number; name: string; unit: string }>;

interface ConvertzCurrencyResponse {
  base: string;
  timestamp: string;
  rates: CurrencyRates;
}

interface ConvertzMetalsResponse extends MetalRates {}

interface ConvertzSnapshot {
  currencyRates: CurrencyRates;
  metals: MetalRates;
  timestamp: number;
  fetchedAt: number;
}

export interface FreeMarketRate {
  valorBc: string;
  pair: string;
  rate: number;
  bid: number;
  ask: number;
  change24h: number;
  timestamp: number;
  source: "FREE_FALLBACK";
  provider: "CONVERTZ";
}

const CONVERTZ_CURRENCY_URL = "https://convertz.app/api/currency";
const CONVERTZ_METALS_URL = "https://convertz.app/api/metals";
const CACHE_TTL_MS = 60_000;

let cachedSnapshot: ConvertzSnapshot | null = null;
let inflightSnapshot: Promise<ConvertzSnapshot> | null = null;

function getPairRate(
  pair: string,
  currencyRates: CurrencyRates,
  metals: MetalRates
) {
  switch (pair) {
    case "USD/NGN":
      return currencyRates.NGN;
    case "GBP/NGN":
      return currencyRates.NGN / currencyRates.GBP;
    case "USD/KES":
      return currencyRates.KES;
    case "GBP/KES":
      return currencyRates.KES / currencyRates.GBP;
    case "USD/GHS":
      return currencyRates.GHS;
    case "EUR/USD":
      return 1 / currencyRates.EUR;
    case "GBP/USD":
      return 1 / currencyRates.GBP;
    case "CHF/USD":
      return 1 / currencyRates.CHF;
    case "XAU/USD":
      return metals.XAU?.price;
    case "XAG/USD":
      return metals.XAG?.price;
    case "XPT/USD":
      return metals.XPT?.price;
    case "XPD/USD":
      return metals.XPD?.price;
    default:
      return undefined;
  }
}

async function fetchConvertzSnapshot(): Promise<ConvertzSnapshot> {
  const [currencyResponse, metalsResponse] = await Promise.all([
    fetch(CONVERTZ_CURRENCY_URL, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    }),
    fetch(CONVERTZ_METALS_URL, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    }),
  ]);

  if (!currencyResponse.ok) {
    throw new Error(`Convertz currency fetch failed with ${currencyResponse.status}`);
  }

  if (!metalsResponse.ok) {
    throw new Error(`Convertz metals fetch failed with ${metalsResponse.status}`);
  }

  const currencyData =
    (await currencyResponse.json()) as ConvertzCurrencyResponse;
  const metalsData = (await metalsResponse.json()) as ConvertzMetalsResponse;

  return {
    currencyRates: currencyData.rates,
    metals: metalsData,
    timestamp: Date.parse(currencyData.timestamp) || Date.now(),
    fetchedAt: Date.now(),
  };
}

async function getConvertzSnapshot(): Promise<ConvertzSnapshot> {
  if (cachedSnapshot && Date.now() - cachedSnapshot.fetchedAt < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  if (!inflightSnapshot) {
    inflightSnapshot = fetchConvertzSnapshot()
      .then((snapshot) => {
        cachedSnapshot = snapshot;
        return snapshot;
      })
      .finally(() => {
        inflightSnapshot = null;
      });
  }

  try {
    return await inflightSnapshot;
  } catch (error) {
    if (cachedSnapshot) {
      return cachedSnapshot;
    }

    throw error;
  }
}

export async function getFallbackRateByPair(params: {
  valorBc: string;
  pair: string;
}): Promise<FreeMarketRate> {
  const snapshot = await getConvertzSnapshot();
  const rate = getPairRate(
    params.pair,
    snapshot.currencyRates,
    snapshot.metals
  );

  if (rate == null || Number.isNaN(rate)) {
    throw new Error(`Fallback rate unavailable for ${params.pair}`);
  }

  return {
    valorBc: params.valorBc,
    pair: params.pair,
    rate,
    bid: rate,
    ask: rate,
    change24h: 0,
    timestamp: snapshot.timestamp,
    source: "FREE_FALLBACK",
    provider: "CONVERTZ",
  };
}

export async function getFallbackRatesByValorBc(
  pairs: Array<{ valorBc: string; pair: string }>
) {
  return Promise.all(
    pairs.map((entry) =>
      getFallbackRateByPair({ valorBc: entry.valorBc, pair: entry.pair })
    )
  );
}
