import { NextRequest, NextResponse } from "next/server";
import { requireWalletSession } from "@/lib/server/wallet-auth";
import { getPrismaClient } from "@/lib/server/prisma";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const status = /Missing wallet address|Invalid wallet address/i.test(message)
    ? 401
    : 500;

  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireWalletSession(req);
    const prisma = await getPrismaClient();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";

    const currentInstitution = await prisma.institution.findFirst({
      where: { wallet: session.walletAddress },
      select: { id: true },
    });

    const institutions = await prisma.institution.findMany({
      where: {
        isActive: true,
        id: currentInstitution ? { not: currentInstitution.id } : undefined,
        onboardingCompletedAt: { not: null },
        OR: q
          ? [
              { name: { contains: q, mode: "insensitive" } },
              { jurisdiction: { contains: q, mode: "insensitive" } },
              { travelRuleVaspId: { contains: q, mode: "insensitive" } },
            ]
          : undefined,
      },
      orderBy: [{ kycTier: "desc" }, { name: "asc" }],
      take: 20,
      select: {
        id: true,
        lei: true,
        name: true,
        wallet: true,
        jurisdiction: true,
        kycTier: true,
        travelRuleVaspId: true,
      },
    });

    return NextResponse.json({
      institutions: institutions.map((institution) => ({
        id: institution.id,
        onChainInstitutionId: institution.lei ?? institution.id,
        name: institution.name,
        wallet: institution.wallet,
        jurisdiction: institution.jurisdiction,
        kycTier: institution.kycTier,
        travelRuleVaspId: institution.travelRuleVaspId,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
