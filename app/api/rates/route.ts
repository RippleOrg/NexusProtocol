import { NextResponse } from "next/server";
import { sixBfiClient } from "@/lib/integrations/six-bfi";
import { getStreamClient } from "@/lib/integrations/six-bfi-stream";

const FX_PAIRS = [
  { base: "USD", quote: "NGN", label: "USDC/NGNC", valorBc: "199113_148" },
  { base: "USD", quote: "KES", label: "USDC/KESC", valorBc: "275141_148" },
  { base: "USD", quote: "GHS", label: "USDC/GHSC", valorBc: "3206444_148" },
  { base: "EUR", quote: "USD", label: "USDC/EURC", valorBc: "946681_148" },
  { base: "GBP", quote: "USD", label: "USDC/GBPC", valorBc: "275017_148" },
  { base: "USD", quote: "SGD", label: "USDC/SGDC", valorBc: "" },
];

export async function GET() {
  try {
    const streamClient = getStreamClient();
    const fetchStart = Date.now();

    const rates = await Promise.allSettled(
      FX_PAIRS.map(async ({ base, quote, label, valorBc }) => {
        // 1. Try stream (sub-millisecond) if valorBc is mapped and not stale
        if (valorBc) {
          const streamRate = streamClient.getLatestRate(valorBc);
          if (streamRate && !streamRate.isStale) {
            return {
              pair: `${base}${quote}`,
              label,
              rate: streamRate.lastPrice,
              bid: streamRate.bid,
              ask: streamRate.ask,
              change24h: streamRate.changePct24h,
              timestamp: streamRate.timestamp,
              source: "SIX_BFI" as const,
              rateSource: "STREAM" as const,
              latencyMs: Date.now() - streamRate.timestamp,
            };
          }
        }

        // 2. Fall back to REST intradaySnapshot
        const rate = await sixBfiClient.getFxRate(base, quote);
        return {
          ...rate,
          label,
          rateSource: "REST" as const,
          latencyMs: Date.now() - fetchStart,
        };
      })
    );

    // Determine overall source for response headers
    const firstFulfilled = rates.find((r) => r.status === "fulfilled");
    const overallSource =
      firstFulfilled?.status === "fulfilled"
        ? firstFulfilled.value.rateSource
        : "REST";

    const result = rates.map((r, i) => {
      if (r.status === "fulfilled") {
        return r.value;
      }
      return {
        pair: `${FX_PAIRS[i].base}${FX_PAIRS[i].quote}`,
        label: FX_PAIRS[i].label,
        rate: 0,
        bid: 0,
        ask: 0,
        timestamp: Date.now(),
        change24h: 0,
        source: "SIX_BFI" as const,
        rateSource: "CACHE" as const,
        latencyMs: 0,
        error: true,
      };
    });

    return NextResponse.json(
      { rates: result, fetchedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
          "X-Rate-Source": overallSource,
          "X-Rate-Latency": String(Date.now() - fetchStart),
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch FX rates", message: String(err) },
      { status: 500 }
    );
  }
}
