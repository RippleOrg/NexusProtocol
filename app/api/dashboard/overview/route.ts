import { NextRequest, NextResponse } from "next/server";
import { requireWalletSession } from "@/lib/server/wallet-auth";
import { getOnChainDashboardOverview } from "@/lib/server/onchain-escrows";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const status = /Missing wallet address|Invalid wallet address/i.test(message)
    ? 401
    : /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|failed to get|All Solana RPC providers failed/i.test(
          message
        )
      ? 503
    : 500;

  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireWalletSession(req);
    const overview = await getOnChainDashboardOverview(session.walletAddress);

    return NextResponse.json(overview);
  } catch (error) {
    return errorResponse(error);
  }
}
