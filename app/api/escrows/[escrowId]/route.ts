import { NextRequest, NextResponse } from "next/server";
import { requireWalletSession } from "@/lib/server/wallet-auth";
import { getOnChainEscrowRecord } from "@/lib/server/onchain-escrows";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const status = /Missing wallet address|Invalid wallet address/i.test(message)
    ? 401
    : 500;

  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ escrowId: string }> }
) {
  try {
    const { escrowId } = await context.params;
    await requireWalletSession(req);
    const escrow = await getOnChainEscrowRecord(escrowId);

    if (!escrow) {
      return NextResponse.json({ error: "Escrow not found" }, { status: 404 });
    }

    return NextResponse.json({ escrow });
  } catch (error) {
    return errorResponse(error);
  }
}
