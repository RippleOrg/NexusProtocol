import { getSolstreamClient } from "@/lib/integrations/solstream";
import type { NexusComplianceEvent } from "@/lib/integrations/solstream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const solstream = getSolstreamClient();
  const encoder = new TextEncoder();

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;

  function cleanup() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  const stream = new ReadableStream({
    start(controller) {
      // Send initial snapshot of recent events from the ring buffer
      const recent = solstream.getRecentEvents("all", 50);
      if (recent.length > 0) {
        const snapshotMsg = `data: ${JSON.stringify({
          type: "snapshot",
          events: recent,
        })}\n\n`;
        controller.enqueue(encoder.encode(snapshotMsg));
      }

      // Inform client of connection status
      const connectMsg = `data: ${JSON.stringify({
        type: "connected",
        streaming: solstream.isConnected,
      })}\n\n`;
      controller.enqueue(encoder.encode(connectMsg));

      // Relay live compliance events to the SSE client
      unsubscribe = solstream.onComplianceEvent(
        (event: NexusComplianceEvent) => {
          try {
            const sseData = `data: ${JSON.stringify({
              type: "compliance_event",
              event,
            })}\n\n`;
            controller.enqueue(encoder.encode(sseData));
          } catch {
            // Client disconnected — cleanup handled by cancel()
          }
        }
      );

      // Heartbeat every 15 seconds
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "heartbeat",
                streaming: solstream.isConnected,
                timestamp: Date.now(),
              })}\n\n`
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
