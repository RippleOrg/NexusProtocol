import crypto from "crypto";
import type { Institution as PrismaInstitution, PrismaClient } from "@prisma/client";
import bs58 from "bs58";
import { PublicKey, type Connection } from "@solana/web3.js";
import type { DashboardOverview, EscrowRecord } from "@/lib/nexus/types";
import { PROGRAM_ID } from "@/lib/nexus/constants";
import {
  serialiseInstitution,
  summariseEscrowRecords,
} from "@/lib/server/nexus-data";
import { withSolanaReadFallback } from "@/lib/server/solana-rpc";

type InstitutionLookup = {
  name: string;
  onChainInstitutionId: string;
};

type EscrowDbEnrichment = {
  id: string;
  fxRate: number | null;
  settlementAmount: string | null;
  travelRuleLogPda: string | null;
  sourceOfFundsHash: string | null;
};

type DbSnapshot = {
  currentInstitution: PrismaInstitution | null;
  institutionByOnChainId: Map<string, InstitutionLookup>;
  escrowByPda: Map<string, EscrowDbEnrichment>;
  amlClearRate: number;
  kytAlertCount: number;
};

type ParsedEscrowAccount = {
  escrowId: string;
  importerInstitutionId: string;
  exporterInstitutionId: string;
  tokenMint: string;
  settlementMint: string;
  depositAmount: string;
  statusCode: number;
  conditionsTotal: number;
  conditionsSatisfied: number;
  travelRuleAttached: boolean;
  sourceOfFundsHash: string;
  expiresAt: string;
  createdAt: string;
  settledAt: string | null;
};

function mapEscrowStatus(statusCode: number): EscrowRecord["status"] {
  switch (statusCode) {
    case 0:
      return "Created";
    case 1:
      return "Funded";
    case 2:
      return "ConditionsPartial";
    case 3:
      return "ConditionsSatisfied";
    case 4:
      return "InDispute";
    case 5:
      return "Settled";
    case 6:
      return "Refunded";
    case 7:
      return "Expired";
    default:
      return "Created";
  }
}

function unixSecondsToIso(value: bigint | number | null | undefined) {
  if (value == null) {
    return null;
  }

  const seconds = typeof value === "bigint" ? Number(value) : value;
  return new Date(seconds * 1000).toISOString();
}

function anchorDiscriminator(name: string) {
  return crypto
    .createHash("sha256")
    .update(`account:${name}`)
    .digest()
    .subarray(0, 8);
}

class BorshReader {
  private readonly data: Buffer;
  private offset: number;

  constructor(data: Buffer, startOffset = 0) {
    this.data = data;
    this.offset = startOffset;
  }

  skip(bytes: number) {
    this.offset += bytes;
  }

  readU8() {
    if (this.offset + 1 > this.data.length) {
      throw new RangeError("BorshReader buffer underflow");
    }

    const value = this.data.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readU16() {
    if (this.offset + 2 > this.data.length) {
      throw new RangeError("BorshReader buffer underflow");
    }

    const value = this.data.readUInt16LE(this.offset);
    this.offset += 2;
    return value;
  }

  readU32() {
    if (this.offset + 4 > this.data.length) {
      throw new RangeError("BorshReader buffer underflow");
    }

    const value = this.data.readUInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  readU64() {
    if (this.offset + 8 > this.data.length) {
      throw new RangeError("BorshReader buffer underflow");
    }

    const value = this.data.readBigUInt64LE(this.offset);
    this.offset += 8;
    return value;
  }

  readI64() {
    if (this.offset + 8 > this.data.length) {
      throw new RangeError("BorshReader buffer underflow");
    }

    const value = this.data.readBigInt64LE(this.offset);
    this.offset += 8;
    return value;
  }

  readString() {
    const length = this.readU32();
    if (this.offset + length > this.data.length) {
      throw new RangeError("BorshReader string underflow");
    }

    const value = this.data.toString("utf8", this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  readBool() {
    return this.readU8() !== 0;
  }

  readBytes(length: number) {
    if (this.offset + length > this.data.length) {
      throw new RangeError("BorshReader bytes underflow");
    }

    const value = this.data.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  readPublicKey() {
    return new PublicKey(this.readBytes(32)).toBase58();
  }

  readOptionI64() {
    return this.readU8() === 0 ? null : this.readI64();
  }
}

function skipCollateralConfig(reader: BorshReader) {
  reader.readU8();
  reader.skip(32);
  reader.skip(8);
  reader.readString();
  reader.skip(8);
  reader.skip(8);
  reader.readU16();
  reader.readU16();
  reader.readBool();
}

function skipTradeCondition(reader: BorshReader) {
  reader.readU8();
  reader.readString();

  if (reader.readU8()) {
    reader.skip(32);
  }

  if (reader.readU8()) {
    reader.skip(32);
  }

  if (reader.readU8()) {
    reader.skip(8);
  }

  if (reader.readU8()) {
    reader.skip(8);
  }

  const isSatisfied = reader.readBool();

  if (reader.readU8()) {
    reader.skip(8);
  }

  if (reader.readU8()) {
    reader.skip(32);
  }

  reader.readU16();
  return isSatisfied;
}

function parseEscrowAccount(data: Buffer): ParsedEscrowAccount | null {
  try {
    const reader = new BorshReader(data, 8);

    const escrowId = reader.readString();
    reader.skip(32);
    reader.skip(32);
    const importerInstitutionId = reader.readString();
    const exporterInstitutionId = reader.readString();
    const tokenMint = reader.readPublicKey();
    reader.skip(32);
    const depositAmount = reader.readU64().toString();
    reader.readU64();
    const settlementMint = reader.readPublicKey();
    reader.readU16();

    const conditionsTotal = reader.readU32();
    let conditionsSatisfied = 0;

    for (let index = 0; index < conditionsTotal; index += 1) {
      if (skipTradeCondition(reader)) {
        conditionsSatisfied += 1;
      }
    }

    reader.readU8();
    const statusCode = reader.readU8();
    reader.readU8();
    reader.readOptionI64();
    const createdAt = unixSecondsToIso(reader.readI64()) ?? new Date(0).toISOString();
    reader.readOptionI64();
    const settledAt = unixSecondsToIso(reader.readOptionI64());
    const expiresAt = unixSecondsToIso(reader.readI64()) ?? new Date(0).toISOString();
    const travelRuleAttached = reader.readBool();
    const sourceOfFundsHash = reader.readBytes(32).toString("hex");
    const hasCollateral = reader.readU8();

    if (hasCollateral) {
      skipCollateralConfig(reader);
    }

    return {
      escrowId,
      importerInstitutionId,
      exporterInstitutionId,
      tokenMint,
      settlementMint,
      depositAmount,
      statusCode,
      conditionsTotal,
      conditionsSatisfied,
      travelRuleAttached,
      sourceOfFundsHash,
      expiresAt,
      createdAt,
      settledAt,
    };
  } catch {
    return null;
  }
}

function parseTravelRuleLogEscrow(data: Buffer) {
  try {
    const reader = new BorshReader(data, 8);
    reader.readString();
    return reader.readPublicKey();
  } catch {
    return null;
  }
}

async function withOptionalPrisma<T>(
  fn: (prisma: PrismaClient) => Promise<T>
): Promise<T | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    return await fn(prisma);
  } catch {
    return null;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

async function loadDbSnapshot(walletAddress?: string): Promise<DbSnapshot> {
  const snapshot = await withOptionalPrisma(async (prisma) => {
    const [
      currentInstitution,
      institutions,
      escrows,
      clearScreenings,
      totalScreenings,
      kytAlertCount,
    ] = await Promise.all([
      walletAddress
        ? prisma.institution.findFirst({
            where: { wallet: walletAddress },
          })
        : Promise.resolve(null),
      prisma.institution.findMany({
        select: {
          id: true,
          name: true,
          lei: true,
        },
      }),
      prisma.escrow.findMany({
        select: {
          id: true,
          onChainPda: true,
          fxRate: true,
          settlementAmount: true,
          travelRuleLogPda: true,
          sourceOfFundsHash: true,
        },
      }),
      prisma.amlScreening.count({
        where: { recommendation: "CLEAR" },
      }),
      prisma.amlScreening.count(),
      prisma.kytEvent.count({
        where: { resolvedAt: null },
      }),
    ]);

    return {
      currentInstitution,
      institutionByOnChainId: new Map(
        institutions.map((institution) => [
          institution.lei ?? institution.id,
          {
            name: institution.name,
            onChainInstitutionId: institution.lei ?? institution.id,
          },
        ])
      ),
      escrowByPda: new Map(
        escrows.map((escrow) => [
          escrow.onChainPda,
          {
            id: escrow.id,
            fxRate: escrow.fxRate,
            settlementAmount: escrow.settlementAmount?.toString() ?? null,
            travelRuleLogPda: escrow.travelRuleLogPda,
            sourceOfFundsHash: escrow.sourceOfFundsHash,
          },
        ])
      ),
      amlClearRate:
        totalScreenings > 0
          ? Math.round((clearScreenings / totalScreenings) * 100)
          : 100,
      kytAlertCount,
    };
  });

  return (
    snapshot ?? {
      currentInstitution: null,
      institutionByOnChainId: new Map<string, InstitutionLookup>(),
      escrowByPda: new Map<string, EscrowDbEnrichment>(),
      amlClearRate: 100,
      kytAlertCount: 0,
    }
  );
}

async function fetchProgramAccounts(
  connection: Connection,
  discriminatorName: string
) {
  const programId = new PublicKey(PROGRAM_ID);
  const discriminator = bs58.encode(anchorDiscriminator(discriminatorName));

  return connection.getProgramAccounts(programId, {
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: discriminator,
        },
      },
    ],
  });
}

async function loadOnChainEscrowRecords(walletAddress?: string): Promise<{
  escrows: EscrowRecord[];
  institution: PrismaInstitution | null;
  amlClearRate: number;
  kytAlertCount: number;
}> {
  const [dbSnapshot, rpcSnapshot] = await Promise.all([
    loadDbSnapshot(walletAddress),
    withSolanaReadFallback(async (connection) => {
      const [escrows, travelRuleLogs] = await Promise.all([
        fetchProgramAccounts(connection, "EscrowAccount"),
        fetchProgramAccounts(connection, "TravelRuleLog").catch(() => []),
      ]);

      return { escrows, travelRuleLogs };
    }),
  ]);
  const escrowAccounts = rpcSnapshot.value.escrows;
  const travelRuleLogs = rpcSnapshot.value.travelRuleLogs;

  const travelRuleLogByEscrow = new Map<string, string>();

  for (const entry of travelRuleLogs) {
    const escrowPda = parseTravelRuleLogEscrow(Buffer.from(entry.account.data));
    if (escrowPda) {
      travelRuleLogByEscrow.set(escrowPda, entry.pubkey.toBase58());
    }
  }

  const escrows: EscrowRecord[] = [];

  for (const entry of escrowAccounts) {
    const parsedEscrow = parseEscrowAccount(Buffer.from(entry.account.data));
    if (!parsedEscrow) {
      continue;
    }

    const dbEscrow = dbSnapshot.escrowByPda.get(entry.pubkey.toBase58());
    const importerInstitution =
      dbSnapshot.institutionByOnChainId.get(parsedEscrow.importerInstitutionId);
    const exporterInstitution =
      dbSnapshot.institutionByOnChainId.get(parsedEscrow.exporterInstitutionId);

    escrows.push({
      id: dbEscrow?.id ?? entry.pubkey.toBase58(),
      escrowId: parsedEscrow.escrowId,
      onChainPda: entry.pubkey.toBase58(),
      importerInstitutionId: parsedEscrow.importerInstitutionId,
      importerInstitutionName:
        importerInstitution?.name ?? parsedEscrow.importerInstitutionId,
      exporterInstitutionId: parsedEscrow.exporterInstitutionId,
      exporterInstitutionName:
        exporterInstitution?.name ?? parsedEscrow.exporterInstitutionId,
      depositAmount: parsedEscrow.depositAmount,
      tokenMint: parsedEscrow.tokenMint,
      settlementMint: parsedEscrow.settlementMint,
      status: mapEscrowStatus(parsedEscrow.statusCode),
      conditionsTotal: parsedEscrow.conditionsTotal,
      conditionsSatisfied: parsedEscrow.conditionsSatisfied,
      fxRate: dbEscrow?.fxRate ?? null,
      settlementAmount: dbEscrow?.settlementAmount ?? null,
      travelRuleAttached: parsedEscrow.travelRuleAttached,
      travelRuleLogPda:
        travelRuleLogByEscrow.get(entry.pubkey.toBase58()) ??
        dbEscrow?.travelRuleLogPda ??
        null,
      sourceOfFundsHash:
        dbEscrow?.sourceOfFundsHash ?? parsedEscrow.sourceOfFundsHash,
      expiresAt: parsedEscrow.expiresAt,
      createdAt: parsedEscrow.createdAt,
      settledAt: parsedEscrow.settledAt,
    });
  }

  escrows.sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );

  return {
    escrows,
    institution: dbSnapshot.currentInstitution,
    amlClearRate: dbSnapshot.amlClearRate,
    kytAlertCount: dbSnapshot.kytAlertCount,
  };
}

export async function listOnChainEscrowRecords() {
  const result = await loadOnChainEscrowRecords();
  return result.escrows;
}

export async function getOnChainEscrowRecord(escrowId: string) {
  const escrows = await listOnChainEscrowRecords();

  return (
    escrows.find(
      (escrow) =>
        escrow.id === escrowId ||
        escrow.escrowId === escrowId ||
        escrow.onChainPda === escrowId
    ) ?? null
  );
}

export async function getOnChainDashboardOverview(
  walletAddress?: string
): Promise<DashboardOverview> {
  const { escrows, institution, amlClearRate, kytAlertCount } =
    await loadOnChainEscrowRecords(walletAddress);

  return summariseEscrowRecords({
    institution: serialiseInstitution(institution),
    escrows,
    amlClearRate,
    kytAlertCount,
  });
}
