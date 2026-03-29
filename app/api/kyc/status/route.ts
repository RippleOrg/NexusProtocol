import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getAdminProgramContext } from "@/lib/server/nexus-admin";
import { deriveKycRecordPda } from "@/lib/nexus/onchain";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");

  if (!institutionId) {
    return NextResponse.json(
      { error: "institutionId is required" },
      { status: 400 }
    );
  }

  try {
    // Try to fetch from DB first
    try {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      const institution = await prisma.institution.findFirst({
        where: {
          OR: [{ id: institutionId }, { name: institutionId }],
        },
      });
      await prisma.$disconnect();

      if (institution) {
        return NextResponse.json({
          id: institution.id,
          name: institution.name,
          isActive: institution.isActive,
          tier: institution.kycTier,
          expiresAt: institution.kycExpiresAt?.toISOString() ?? null,
          jurisdiction: institution.jurisdiction,
        });
      }
    } catch {
      // DB not available
    }

    // Fall back to on-chain derivation
    const { program } = await getAdminProgramContext();
    const kycRecordPda = new PublicKey(deriveKycRecordPda(institutionId));
    const account = await program.account.kycRecord.fetchNullable(kycRecordPda);

    if (account) {
      return NextResponse.json({
        isActive: account.isActive,
        tier: account.kycTier,
        expiresAt: new Date(Number(account.expiresAt) * 1000).toISOString(),
        jurisdiction: account.jurisdiction,
        wallet: account.wallet.toBase58(),
        pda: kycRecordPda.toBase58(),
      });
    }

    return NextResponse.json({
      isActive: false,
      tier: 0,
      expiresAt: null,
      jurisdiction: "",
      pda: kycRecordPda.toBase58(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch KYC status", message: String(err) },
      { status: 500 }
    );
  }
}
