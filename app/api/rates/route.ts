import { NextResponse } from "next/server";
import { getSixBfiClient } from "@/lib/integrations/six-bfi";
import { getStreamClient } from "@/lib/integrations/six-bfi-stream";
import { getFallbackRateByPair } from "@/lib/integrations/free-market-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FX_PAIRS = [
  { base: "USD", quote: "NGN", pair: "USD/NGN", label: "USDC/NGNC", valorBc: "199113_148" },
  { base: "USD", quote: "KES", pair: "USD/KES", label: "USDC/KESC", valorBc: "275141_148" },
  { base: "USD", quote: "GHS", pair: "USD/GHS", label: "USDC/GHSC", valorBc: "3206444_148" },
  { base: "EUR", quote: "USD", pair: "EUR/USD", label: "USDC/EURC", valorBc: "946681_148" },
  { base: "GBP", quote: "USD", pair: "GBP/USD", label: "USDC/GBPC", valorBc: "275017_148" },
  { base: "USD", quote: "SGD", pair: "USD/SGD", label: "USDC/SGDC", valorBc: "" },
];

export async function GET() {
  try {
    const sixBfiClient = getSixBfiClient();
    const streamClient = getStreamClient();
    const fetchStart = Date.now();

    const rates = await Promise.allSettled(
      FX_PAIRS.map(async ({ base, quote, pair, label, valorBc }) => {
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
              provider: "SIX_BFI_STREAM" as const,
              latencyMs: Date.now() - streamRate.timestamp,
            };
          }
        }

        // 2. Fall back to REST intradaySnapshot
        try {
          const rate = await sixBfiClient.getFxRate(base, quote);
          return {
            ...rate,
            label,
            rateSource: "REST" as const,
            provider: "SIX_BFI_REST" as const,
            latencyMs: Date.now() - fetchStart,
          };
        } catch {
          if (!valorBc) {
            throw new Error(`No fallback configured for ${pair}`);
          }

          const fallbackRate = await getFallbackRateByPair({
            valorBc,
            pair,
          });

          return {
            pair: `${base}${quote}`,
            label,
            rate: fallbackRate.rate,
            bid: fallbackRate.bid,
            ask: fallbackRate.ask,
            change24h: fallbackRate.change24h,
            timestamp: fallbackRate.timestamp,
            source: fallbackRate.source,
            rateSource: "FALLBACK" as const,
            provider: fallbackRate.provider,
            latencyMs: Date.now() - fetchStart,
          };
        }
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
        provider: "UNAVAILABLE" as const,
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
