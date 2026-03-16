import { NextRequest, NextResponse } from "next/server";
import { fireblocksClient } from "@/lib/integrations/fireblocks";
import type { FireblocksWebhookPayload } from "@/lib/integrations/fireblocks";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("fireblocks-signature") ?? "";
    const publicKey = process.env.FIREBLOCKS_WEBHOOK_PUBLIC_KEY ?? "";

    // Verify webhook signature if public key is configured
    if (publicKey && signature) {
      const isValid = fireblocksClient.verifyWebhookSignature(
        rawBody,
        signature,
        publicKey
      );
      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid webhook signature" },
          { status: 401 }
        );
      }
    }

    const payload = JSON.parse(rawBody) as FireblocksWebhookPayload;
    await fireblocksClient.webhookHandler(payload);

    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Webhook processing failed", message: String(err) },
      { status: 500 }
    );
  }
}
