import { getStreamClient } from "@/lib/integrations/six-bfi-stream";
import type { StreamRate, RateUpdateEvent } from "@/lib/integrations/six-bfi-stream";
import { getFallbackRatesByValorBc } from "@/lib/integrations/free-market-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const streamClient = getStreamClient();
  const subscriptions = [
    { valorBc: "199113_148", pair: "USD/NGN" },
    { valorBc: "282981_148", pair: "GBP/NGN" },
    { valorBc: "275141_148", pair: "USD/KES" },
    { valorBc: "199615_148", pair: "GBP/KES" },
    { valorBc: "3206444_148", pair: "USD/GHS" },
    { valorBc: "946681_148", pair: "EUR/USD" },
    { valorBc: "275017_148", pair: "GBP/USD" },
    { valorBc: "275164_148", pair: "CHF/USD" },
    { valorBc: "274702_148", pair: "XAU/USD" },
    { valorBc: "274720_148", pair: "XAG/USD" },
    { valorBc: "287635_148", pair: "XPT/USD" },
    { valorBc: "283501_148", pair: "XPD/USD" },
  ];

  const encoder = new TextEncoder();

  // Mutable cleanup references shared between start and cancel
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let onUpdate: ((event: RateUpdateEvent) => void) | null = null;

  function cleanup() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (onUpdate) {
      streamClient.off("rate_update", onUpdate);
      onUpdate = null;
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial snapshot of all cached rates
      const initialRates: StreamRate[] = [];
      for (const { valorBc } of subscriptions) {
        const rate = streamClient.getLatestRate(valorBc);
        if (rate) initialRates.push(rate);
      }

      if (initialRates.length === 0) {
        try {
          const fallbackRates = await getFallbackRatesByValorBc(subscriptions);
          initialRates.push(
            ...fallbackRates.map((rate) => ({
              valorBc: rate.valorBc,
              pair: rate.pair,
              lastPrice: rate.rate,
              bid: rate.bid,
              ask: rate.ask,
              change24h: 0,
              changePct24h: 0,
              timestamp: rate.timestamp,
              isStale: true,
            }))
          );
        } catch {
          // leave empty snapshot when both live and fallback sources fail
        }
      }

      if (initialRates.length > 0) {
        const event = `data: ${JSON.stringify({ type: "snapshot", rates: initialRates })}\n\n`;
        controller.enqueue(encoder.encode(event));
      }

      // Send connection confirmation
      const connectEvent = `data: ${JSON.stringify({ type: "connected", streaming: streamClient.isConnected })}\n\n`;
      controller.enqueue(encoder.encode(connectEvent));

      // Subscribe to live updates
      onUpdate = (event: RateUpdateEvent) => {
        try {
          const { rate } = event;
          const sseData = `data: ${JSON.stringify({
            type: "rate_update",
            pair: rate.pair,
            valorBc: rate.valorBc,
            rate: rate.lastPrice,
            bid: rate.bid,
            ask: rate.ask,
            change24h: rate.changePct24h,
            timestamp: rate.timestamp,
          })}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        } catch {
          // Client disconnected — cleanup handled by cancel()
        }
      };

      streamClient.on("rate_update", onUpdate);

      // Heartbeat every 15 seconds
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "heartbeat", streaming: streamClient.isConnected, timestamp: Date.now() })}\n\n`
            )
          );
        } catch {
          cleanup();
        }
      }, 15_000);
    },

    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
