import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  provisionInstitutionLiquidity,
  registerInstitutionOnChain,
} from "@/lib/server/nexus-admin";
import { requireWalletSession } from "@/lib/server/wallet-auth";

const VerifyKycSchema = z.object({
  wallet: z.string().min(32).max(44),
  institutionId: z.string().min(1).max(32),
  tier: z.number().int().min(1).max(3),
  jurisdiction: z.string().min(2).max(16),
  vaspId: z.string().max(64).optional().default(""),
  expiresAt: z.string().datetime(),
  institutionName: z.string().min(2).max(120).optional(),
  entityType: z.string().max(64).optional(),
  licenseNumber: z.string().max(64).optional(),
  regulatorName: z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireWalletSession(req);
    const body = (await req.json()) as unknown;
    const parsed = VerifyKycSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      wallet,
      institutionId,
      tier,
      jurisdiction,
      vaspId,
      expiresAt,
      institutionName,
      entityType,
      licenseNumber,
      regulatorName,
    } =
      parsed.data;

    if (wallet !== session.walletAddress) {
      return NextResponse.json(
        { error: "Connected wallet does not match the submitted KYC wallet" },
        { status: 403 }
      );
    }

    let onChain;
    try {
      onChain = await registerInstitutionOnChain({
        institutionId,
        wallet,
        tier,
        jurisdiction,
        vaspId,
        expiresAt: new Date(expiresAt),
      });
    } catch (error) {
      throw new Error(
        `On-chain institution registration failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    let liquidity;
    try {
      liquidity = await provisionInstitutionLiquidity(wallet);
    } catch (error) {
      throw new Error(
        `Devnet USDC funding failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    // Store in database
    try {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      await prisma.institution.upsert({
        where: { wallet },
        create: {
          wallet,
          name: institutionName ?? institutionId,
          lei: institutionId,
          entityType: entityType ?? null,
          licenseNumber: licenseNumber ?? null,
          regulatorName: regulatorName ?? null,
          travelRuleVaspId: vaspId || null,
          jurisdiction,
          kycTier: tier,
          kycVerifiedAt: new Date(),
          kycExpiresAt: new Date(expiresAt),
          isActive: true,
        },
        update: {
          name: institutionName ?? institutionId,
          lei: institutionId,
          entityType: entityType ?? null,
          licenseNumber: licenseNumber ?? null,
          regulatorName: regulatorName ?? null,
          travelRuleVaspId: vaspId || null,
          kycTier: tier,
          kycVerifiedAt: new Date(),
          kycExpiresAt: new Date(expiresAt),
          jurisdiction,
          isActive: true,
        },
      });
      await prisma.$disconnect();
    } catch {
      // DB not available in all environments; continue
    }

    return NextResponse.json({
      success: true,
      kycRecordPda: onChain.kycRecordPda,
      tier,
      institutionId,
      fundedMint: liquidity.mint,
      fundedTokenAccount: liquidity.tokenAccount,
      fundedAmount: liquidity.amount,
      faucetRequired: liquidity.faucetRequired ?? false,
      faucetUrl: liquidity.faucetUrl ?? null,
      message:
        liquidity.faucetRequired
          ? "KYC record registered on-chain. Fund official Circle devnet USDC from the public faucet to continue testing."
          : "KYC record registered on-chain and wallet funded successfully",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /Missing wallet address|Invalid wallet address/i.test(message)
      ? 401
      : /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|failed to get/i.test(message)
        ? 503
      : 500;

    return NextResponse.json(
      { error: "KYC verification failed", message },
      { status }
    );
  }
}
