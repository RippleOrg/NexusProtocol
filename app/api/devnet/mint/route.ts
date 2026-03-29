import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mintCustomDevnetAsset } from "@/lib/server/nexus-admin";
import { requireWalletSession } from "@/lib/server/wallet-auth";

const MintDevnetAssetSchema = z.object({
  code: z.string().min(3).max(8),
  amount: z.number().positive().max(1_000_000_000),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireWalletSession(req);
    const body = (await req.json()) as unknown;
    const parsed = MintDevnetAssetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid devnet mint request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await mintCustomDevnetAsset({
      code: parsed.data.code,
      walletAddress: session.walletAddress,
      amount: parsed.data.amount,
    });

    return NextResponse.json({
      success: true,
      asset: result.code,
      mint: result.mint,
      tokenAccount: result.tokenAccount,
      amount: result.amount,
      uiAmount: result.uiAmount,
      signature: result.signature,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /Missing wallet address|Invalid wallet address/i.test(message)
      ? 401
      : /Unsupported devnet asset|official asset|greater than zero/i.test(message)
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
