import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

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
        where: { name: institutionId },
      });
      await prisma.$disconnect();

      if (institution) {
        return NextResponse.json({
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
    const programId = new PublicKey(
      process.env.NEXT_PUBLIC_NEXUS_PROGRAM_ID ??
        "NXSvFssBwGNZPpPSS5tcMqQLYbFf8yRKXBiARUdGi7Mb"
    );
    const [kycRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc-record"), Buffer.from(institutionId)],
      programId
    );

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
