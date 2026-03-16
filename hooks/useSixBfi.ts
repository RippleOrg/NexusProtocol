import { useQuery } from "@tanstack/react-query";

export interface SixBfiRate {
  pair: string;
  label: string;
  rate: number;
  bid: number;
  ask: number;
  change24h: number;
  source: "SIX_BFI";
}

export function useSixBfi() {
  return useQuery({
    queryKey: ["six-bfi-rates"],
    queryFn: async (): Promise<SixBfiRate[]> => {
      const res = await fetch("/api/rates");
      if (!res.ok) throw new Error("Failed to fetch SIX BFI rates");
      const data = (await res.json()) as { rates: SixBfiRate[] };
      return data.rates;
    },
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}

export function useSixBfiRate(pair: string) {
  const { data, ...rest } = useSixBfi();
  const rate = data?.find((r) => r.pair === pair || r.pair.startsWith(pair.slice(0, 3)));
  return { rate, ...rest };
}
