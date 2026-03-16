import { useQuery } from "@tanstack/react-query";

export interface FxRateData {
  pair: string;
  label: string;
  rate: number;
  bid: number;
  ask: number;
  change24h: number;
  timestamp: number;
  source: "SIX_BFI";
  error?: boolean;
}

async function fetchFxRates(): Promise<FxRateData[]> {
  const res = await fetch("/api/rates");
  if (!res.ok) throw new Error("Failed to fetch FX rates");
  const data = (await res.json()) as { rates: FxRateData[] };
  return data.rates;
}

export function useFxRates() {
  return useQuery({
    queryKey: ["fx-rates"],
    queryFn: fetchFxRates,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

export function useFxRate(pair: string) {
  const query = useFxRates();
  const rate = query.data?.find((r) => r.pair === pair);
  return { ...query, rate };
}
