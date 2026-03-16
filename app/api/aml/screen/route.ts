import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chainalysisClient } from "@/lib/integrations/chainalysis";

const ScreenSchema = z.object({
  wallet: z.string().min(32).max(44),
  escrowId: z.string().optional(),
  amount: z.number().optional(),
  institutionId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const parsed = ScreenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { wallet, escrowId, amount, institutionId } = parsed.data;

    const result = await chainalysisClient.screenAddress(wallet);

    // Store result in DB
    try {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      await prisma.amlScreening.create({
        data: {
          wallet,
          institutionId: institutionId ?? "unknown",
          riskScore: result.riskScore,
          isSanctioned: result.isSanctioned,
          riskCategories: result.riskCategories,
          recommendation: result.recommendation,
          provider: result.provider,
          screenedAt: new Date(result.screenedAt),
        },
      });
      await prisma.$disconnect();
    } catch {
      // DB unavailable
    }

    if (result.isSanctioned || result.recommendation === "BLOCK") {
      return NextResponse.json(
        {
          error: "AML screening blocked",
          recommendation: result.recommendation,
          riskScore: result.riskScore,
          isSanctioned: result.isSanctioned,
          result,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ result, status: "CLEAR" });
  } catch (err) {
    return NextResponse.json(
      { error: "AML screening failed", message: String(err) },
      { status: 500 }
    );
  }
}
