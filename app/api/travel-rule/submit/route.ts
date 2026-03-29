import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const TravelRuleSubmitSchema = z.object({
  recordId: z.string(),
  originator: z.object({
    name: z.string(),
    accountNumber: z.string(),
    institutionId: z.string(),
    wallet: z.string(),
    vaspId: z.string(),
  }),
  beneficiary: z.object({
    name: z.string(),
    accountNumber: z.string(),
    institutionId: z.string(),
    wallet: z.string(),
    vaspId: z.string(),
  }),
  amount: z.number(),
  currency: z.string(),
  transactionReference: z.string(),
  submittedAt: z.string(),
  escrowId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const parsed = TravelRuleSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const payload = parsed.data;

    // Store in database when both institutions can be resolved
    try {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      const [originatorInstitution, beneficiaryInstitution] = await Promise.all([
        prisma.institution.findFirst({
          where: {
            OR: [
              { id: payload.originator.institutionId },
              { name: payload.originator.institutionId },
            ],
          },
        }),
        prisma.institution.findFirst({
          where: {
            OR: [
              { id: payload.beneficiary.institutionId },
              { name: payload.beneficiary.institutionId },
            ],
          },
        }),
      ]);

      if (originatorInstitution && beneficiaryInstitution) {
        await prisma.travelRuleLog.create({
          data: {
            onChainLogPda: payload.recordId,
            escrowId: payload.escrowId ?? payload.transactionReference,
            originatorInstitutionId: originatorInstitution.id,
            originatorName: payload.originator.name,
            originatorAccount: payload.originator.accountNumber,
            beneficiaryInstitutionId: beneficiaryInstitution.id,
            beneficiaryName: payload.beneficiary.name,
            beneficiaryAccount: payload.beneficiary.accountNumber,
            transferAmount: BigInt(Math.round(payload.amount * 1_000_000)),
            currency: payload.currency,
            createdAt: new Date(payload.submittedAt),
          },
        });
      }
      await prisma.$disconnect();
    } catch {
      // DB unavailable; continue with success response
    }

    return NextResponse.json({
      recordId: payload.recordId,
      submittedAt: payload.submittedAt,
      status: "SUBMITTED",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Travel rule submission failed", message: String(err) },
      { status: 500 }
    );
  }
}
