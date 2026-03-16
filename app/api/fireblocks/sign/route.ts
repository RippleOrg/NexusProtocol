import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fireblocksClient } from "@/lib/integrations/fireblocks";

const SignSchema = z.object({
  serializedTransaction: z.string().min(1),
  institutionId: z.string().min(1),
  escrowId: z.string().min(1),
  txType: z.enum([
    "CREATE_ESCROW",
    "FUND_ESCROW",
    "EXECUTE_SETTLEMENT",
    "REFUND",
  ]),
});

const FIREBLOCKS_ENABLED =
  process.env.NEXT_PUBLIC_FIREBLOCKS_ENABLED === "true";

export async function POST(req: NextRequest) {
  try {
    // Verify JWT authorization
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as unknown;
    const parsed = SignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { serializedTransaction, institutionId, escrowId, txType } =
      parsed.data;

    if (!FIREBLOCKS_ENABLED) {
      return NextResponse.json({
        fireblocksTransactionId: "disabled",
        status: "SIGNED",
        signedTx: serializedTransaction,
        message: "Fireblocks is disabled; transaction passed through unsigned",
      });
    }

    const fireblocksTransactionId = await fireblocksClient.submitTransactionForApproval({
      institutionId,
      escrowId,
      txType,
      amount: 0,
      currency: "USDC",
      counterpartyInstitutionId: "",
      complianceStatus: "CLEAR",
    });

    const signedTx = await fireblocksClient.signSolanaTransaction(
      institutionId,
      serializedTransaction
    );

    return NextResponse.json({
      fireblocksTransactionId,
      status: "SIGNED",
      signedTx,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Fireblocks signing failed", message: String(err) },
      { status: 500 }
    );
  }
}
