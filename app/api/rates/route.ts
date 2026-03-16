import { NextResponse } from "next/server";
import { sixBfiClient } from "@/lib/integrations/six-bfi";

const FX_PAIRS = [
  { base: "USD", quote: "NGN", label: "USDC/NGNC" },
  { base: "USD", quote: "KES", label: "USDC/KESC" },
  { base: "USD", quote: "GHS", label: "USDC/GHSC" },
  { base: "EUR", quote: "USD", label: "USDC/EURC" },
  { base: "GBP", quote: "USD", label: "USDC/GBPC" },
  { base: "USD", quote: "SGD", label: "USDC/SGDC" },
];

export async function GET() {
  try {
    const rates = await Promise.allSettled(
      FX_PAIRS.map(async ({ base, quote, label }) => {
        const rate = await sixBfiClient.getFxRate(base, quote);
        return { ...rate, label };
      })
    );

    const result = rates.map((r, i) => {
      if (r.status === "fulfilled") {
        return r.value;
      }
      // Return a fallback with error indication
      return {
        pair: `${FX_PAIRS[i].base}${FX_PAIRS[i].quote}`,
        label: FX_PAIRS[i].label,
        rate: 0,
        bid: 0,
        ask: 0,
        timestamp: Date.now(),
        change24h: 0,
        source: "SIX_BFI" as const,
        error: true,
      };
    });

    return NextResponse.json(
      { rates: result, fetchedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
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
