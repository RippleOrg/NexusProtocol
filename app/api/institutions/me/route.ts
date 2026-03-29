import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireWalletSession } from "@/lib/server/wallet-auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { serialiseInstitution } from "@/lib/server/nexus-data";
import {
  ENTITY_TYPES,
  TRAVEL_RULE_PROTOCOLS,
} from "@/lib/nexus/constants";

const InstitutionUpsertSchema = z.object({
  wallet: z.string().min(32).max(64),
  name: z.string().min(2).max(120),
  jurisdiction: z.string().min(2).max(16),
  entityType: z.enum(ENTITY_TYPES).optional(),
  licenseNumber: z.string().max(64).optional().default(""),
  regulatorName: z.string().max(120).optional().default(""),
  lei: z.string().max(32).optional().default(""),
  kycTier: z.number().int().min(1).max(3),
  kycExpiresAt: z.string().datetime(),
  travelRuleVaspId: z.string().max(64).optional().default(""),
  travelRuleVaspName: z.string().max(120).optional().default(""),
  travelRuleProtocol: z.enum(TRAVEL_RULE_PROTOCOLS).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  fireblocksVaultId: z.string().max(64).optional().default(""),
  fireblocksWebhookUrl: z.string().url().optional().or(z.literal("")),
  onboardingCompleted: z.boolean().optional().default(true),
});

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const status = /Missing wallet address|Invalid wallet address/i.test(message)
    ? 401
    : /Can't reach database server|DATABASE_URL is not configured/i.test(message)
      ? 503
      : 500;

  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireWalletSession(req);
    const prisma = await getPrismaClient();

    const institution = await prisma.institution.findFirst({
      where: {
        wallet: session.walletAddress,
      },
    });

    return NextResponse.json({
      institution: serialiseInstitution(institution),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireWalletSession(req);
    const body = (await req.json()) as unknown;
    const parsed = InstitutionUpsertSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid institution payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const prisma = await getPrismaClient();
    const payload = parsed.data;
    const now = new Date();

    if (payload.wallet !== session.walletAddress) {
      return NextResponse.json(
        { error: "Connected wallet does not match the submitted institution wallet" },
        { status: 403 }
      );
    }

    const existing = await prisma.institution.findFirst({
      where: {
        wallet: payload.wallet,
      },
    });

    const record = existing
      ? await prisma.institution.update({
          where: { id: existing.id },
          data: {
            wallet: payload.wallet,
            name: payload.name,
            entityType: payload.entityType,
            licenseNumber: payload.licenseNumber || null,
            regulatorName: payload.regulatorName || null,
            lei: payload.lei || null,
            jurisdiction: payload.jurisdiction,
            kycTier: payload.kycTier,
            kycVerifiedAt: now,
            kycExpiresAt: new Date(payload.kycExpiresAt),
            isActive: true,
            travelRuleVaspId: payload.travelRuleVaspId || null,
            travelRuleVaspName: payload.travelRuleVaspName || null,
            travelRuleProtocol: payload.travelRuleProtocol ?? null,
            contactEmail: payload.contactEmail || session.email,
            fireblocksVaultId: payload.fireblocksVaultId || null,
            fireblocksWebhookUrl: payload.fireblocksWebhookUrl || null,
            onboardingCompletedAt: payload.onboardingCompleted ? now : null,
            lastLoginAt: now,
          },
        })
      : await prisma.institution.create({
          data: {
            wallet: payload.wallet,
            name: payload.name,
            entityType: payload.entityType,
            licenseNumber: payload.licenseNumber || null,
            regulatorName: payload.regulatorName || null,
            lei: payload.lei || null,
            jurisdiction: payload.jurisdiction,
            kycTier: payload.kycTier,
            kycVerifiedAt: now,
            kycExpiresAt: new Date(payload.kycExpiresAt),
            isActive: true,
            travelRuleVaspId: payload.travelRuleVaspId || null,
            travelRuleVaspName: payload.travelRuleVaspName || null,
            travelRuleProtocol: payload.travelRuleProtocol ?? null,
            contactEmail: payload.contactEmail || session.email,
            fireblocksVaultId: payload.fireblocksVaultId || null,
            fireblocksWebhookUrl: payload.fireblocksWebhookUrl || null,
            onboardingCompletedAt: payload.onboardingCompleted ? now : null,
            lastLoginAt: now,
          },
        });

    return NextResponse.json({ institution: serialiseInstitution(record) });
  } catch (error) {
    return errorResponse(error);
  }
}
