#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const anchor = require("@coral-xyz/anchor");
const { AnchorProvider, BN, Program } = anchor;
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  VersionedTransaction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  transferChecked,
} = require("@solana/spl-token");
const { PrismaClient } = require("@prisma/client");

const nexusIdl = require("../target/idl/nexus.json");

const ONE_TOKEN = 1_000_000n;
const OFFICIAL_CIRCLE_DEVNET_USDC_MINT =
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const OFFICIAL_CIRCLE_DEVNET_EURC_MINT =
  "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr";
const CIRCLE_FAUCET_URL = "https://faucet.circle.com/";
const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_NEXUS_PROGRAM_ID ?? nexusIdl.address
);
const ADMIN_KEYPAIR_PATH =
  process.env.NEXUS_ADMIN_KEYPAIR_PATH ?? "./nexus-deployer.json";

const MINTS = {
  USDC: {
    keypairPath: "keys/devnet/mints/nexus-usd-mint.json",
    address:
      process.env.NEXT_PUBLIC_USDC_MINT ??
      OFFICIAL_CIRCLE_DEVNET_USDC_MINT,
  },
  NGNC: {
    keypairPath: "keys/devnet/mints/ngnc-mint.json",
    address:
      process.env.NEXT_PUBLIC_NGNC_MINT ??
      "ACr41zznMgboQtZZZCxKovtXDbhThwGsyArP665FR3FE",
    venueId: "USDNGN-DV1",
    sixBfiRate: "152500000000",
    baseLiquidity: 3n * ONE_TOKEN,
    quoteLiquidity: 4_575n * ONE_TOKEN,
  },
  KESC: {
    keypairPath: "keys/devnet/mints/kesc-mint.json",
    address:
      process.env.NEXT_PUBLIC_KESC_MINT ??
      "HMZzbKpg4zx8WugM4wJBTppfCzpGVvtzXNRgcczQMQXY",
    venueId: "USDKES-DV1",
    sixBfiRate: "12900000000",
    baseLiquidity: 3n * ONE_TOKEN,
    quoteLiquidity: 387n * ONE_TOKEN,
  },
  GHSC: {
    keypairPath: "keys/devnet/mints/ghsc-mint.json",
    address:
      process.env.NEXT_PUBLIC_GHSC_MINT ??
      "ApoxiRczs86u8Aa4QycxjKEzMU6nZy4LuYQrvKKs9bh6",
    venueId: "USDGHS-DV1",
    sixBfiRate: "1540000000",
    baseLiquidity: 3n * ONE_TOKEN,
    quoteLiquidity: 46n * ONE_TOKEN,
  },
  EURC: {
    keypairPath: "keys/devnet/mints/eurc-mint.json",
    address:
      process.env.NEXT_PUBLIC_EURC_MINT ??
      OFFICIAL_CIRCLE_DEVNET_EURC_MINT,
    venueId: "USDEUR-DV1",
    sixBfiRate: "92000000",
    baseLiquidity: 3n * ONE_TOKEN,
    quoteLiquidity: 2n * ONE_TOKEN,
  },
  GBPC: {
    keypairPath: "keys/devnet/mints/gbpc-mint.json",
    address:
      process.env.NEXT_PUBLIC_GBPC_MINT ??
      "2heB7u3VKeDmWfqj1ztfV6mxUuyYhhQXBPRjyk847JH8",
    venueId: "USDGBP-DV1",
    sixBfiRate: "78000000",
    baseLiquidity: 3n * ONE_TOKEN,
    quoteLiquidity: 2n * ONE_TOKEN,
  },
};

const INSTITUTIONS = {
  atlas: {
    key: "atlas",
    onChainId: "549300ATLASBANK0001",
    name: "Atlas Trade Bank",
    walletPath: "keys/devnet/institutions/atlas-bank.json",
    jurisdiction: "NG",
    tier: 2,
    vaspId: "ATLAS-NG-001",
    entityType: "Bank",
    regulatorName: "CBN Sandbox",
    travelRuleProtocol: "TRISA",
    travelRuleVaspName: "Atlas Nexus Desk",
    contactEmail: "ops@atlasbank.dev",
  },
  cedar: {
    key: "cedar",
    onChainId: "549300CEDARTRD0002",
    name: "Cedar Commodity Trade",
    walletPath: "keys/devnet/institutions/cedar-trade.json",
    jurisdiction: "KE",
    tier: 2,
    vaspId: "CEDAR-KE-001",
    entityType: "Commodity Trader",
    regulatorName: "Capital Markets Authority",
    travelRuleProtocol: "OpenVASP",
    travelRuleVaspName: "Cedar Settlement Desk",
    contactEmail: "ops@cedartrade.dev",
  },
  meridian: {
    key: "meridian",
    onChainId: "549300MERIDIANMM03",
    name: "Meridian FX Liquidity",
    walletPath: "keys/devnet/institutions/meridian-mm.json",
    jurisdiction: "GB",
    tier: 3,
    vaspId: "MERIDIAN-GB-001",
    entityType: "Licensed Fintech",
    regulatorName: "FCA Innovation Hub",
    travelRuleProtocol: "TRISA",
    travelRuleVaspName: "Meridian FX Hub",
    contactEmail: "ops@meridianfx.dev",
  },
};

const TRADE_BLUEPRINTS = [
  {
    escrowId: "ESCATLASFUNDNGN01",
    travelRuleLogId: "TRLATLASFUNDNGN1",
    importer: "atlas",
    exporter: "cedar",
    settlementCode: "NGNC",
    depositAmountUsd: 2,
    documentLabel: "atlas-funded-ngn",
    transactionReference: "ATLAS-NGNC-001",
    mode: "funded",
    disputeWindowHours: 24,
  },
  {
    escrowId: "ESCATLASREADYNG01",
    travelRuleLogId: "TRLATLASREADYNG1",
    importer: "atlas",
    exporter: "meridian",
    settlementCode: "NGNC",
    depositAmountUsd: 2,
    documentLabel: "atlas-ready-ngn",
    transactionReference: "ATLAS-NGNC-READY",
    mode: "ready",
    disputeWindowHours: 24,
  },
  {
    escrowId: "ESCCEDARDSPTNGN01",
    travelRuleLogId: "TRLCEDARDSPTNGN1",
    importer: "cedar",
    exporter: "atlas",
    settlementCode: "NGNC",
    depositAmountUsd: 1,
    documentLabel: "cedar-dispute-ngn",
    transactionReference: "CEDAR-NGNC-DSP",
    mode: "dispute",
    disputeWindowHours: 24,
  },
  {
    escrowId: "ESCATLASSETLNGN01",
    travelRuleLogId: "TRLATLASSETLNGN1",
    importer: "meridian",
    exporter: "atlas",
    settlementCode: "NGNC",
    depositAmountUsd: 3,
    documentLabel: "atlas-settled-ngn",
    transactionReference: "ATLAS-NGNC-002",
    mode: "settled",
    disputeWindowHours: 0,
  },
  {
    escrowId: "ESCCEDARREFDGBP01",
    travelRuleLogId: "TRLCEDARREFDGBP1",
    importer: "cedar",
    exporter: "meridian",
    settlementCode: "NGNC",
    depositAmountUsd: 1,
    documentLabel: "cedar-refund-gbp",
    transactionReference: "CEDAR-GBPC-003",
    mode: "refunded",
    disputeWindowHours: 24,
  },
];

function readKeypair(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const secretKey = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

function createAnchorWallet(keypair) {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async (transaction) => {
      if (transaction instanceof Transaction) {
        transaction.partialSign(keypair);
      } else if (transaction instanceof VersionedTransaction) {
        transaction.sign([keypair]);
      }
      return transaction;
    },
    signAllTransactions: async (transactions) =>
      transactions.map((transaction) => {
        if (transaction instanceof Transaction) {
          transaction.partialSign(keypair);
        } else if (transaction instanceof VersionedTransaction) {
          transaction.sign([keypair]);
        }
        return transaction;
      }),
  };
}

function isOfficialDevnetMint(address) {
  return (
    address === OFFICIAL_CIRCLE_DEVNET_USDC_MINT ||
    address === OFFICIAL_CIRCLE_DEVNET_EURC_MINT
  );
}

function canAdminMint(config) {
  return !isOfficialDevnetMint(config.address);
}

function sha256Bytes(input) {
  return Array.from(crypto.createHash("sha256").update(input).digest());
}

function derivePda(seeds) {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
}

function deriveProtocolConfigPda() {
  return derivePda([Buffer.from("protocol-config")]);
}

function deriveKycRegistryPda() {
  return derivePda([Buffer.from("kyc-registry")]);
}

function deriveKycRecordPda(institutionId) {
  return derivePda([Buffer.from("kyc-record"), Buffer.from(institutionId)]);
}

function deriveEscrowPda(escrowId) {
  return derivePda([Buffer.from("escrow"), Buffer.from(escrowId)]);
}

function deriveVaultPda(escrowId) {
  return derivePda([Buffer.from("vault"), Buffer.from(escrowId)]);
}

function deriveTravelRuleLogPda(logId) {
  return derivePda([Buffer.from("travel-rule-log"), Buffer.from(logId)]);
}

function deriveFxVenuePda(baseMint, quoteMint) {
  return derivePda([
    Buffer.from("fx-venue"),
    baseMint.toBuffer(),
    quoteMint.toBuffer(),
  ]);
}

function deriveFxVaultBasePda(fxVenue) {
  return derivePda([Buffer.from("fx-vault-base"), fxVenue.toBuffer()]);
}

function deriveFxVaultQuotePda(fxVenue) {
  return derivePda([Buffer.from("fx-vault-quote"), fxVenue.toBuffer()]);
}

function toBigInt(value) {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    return BigInt(value);
  }
  return BigInt(value.toString());
}

function unixSecondsToDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "number") {
    return new Date(value * 1000);
  }

  return new Date(Number(value.toString()) * 1000);
}

function statusKey(status) {
  return Object.keys(status ?? {})[0] ?? "created";
}

function statusLabel(status) {
  switch (statusKey(status)) {
    case "created":
      return "Created";
    case "funded":
      return "Funded";
    case "conditionsPartial":
      return "ConditionsPartial";
    case "conditionsSatisfied":
      return "ConditionsSatisfied";
    case "inDispute":
      return "InDispute";
    case "settled":
      return "Settled";
    case "refunded":
      return "Refunded";
    case "expired":
      return "Expired";
    default:
      return "Created";
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureWalletBalance(connection, admin, wallet, minimumLamports) {
  const currentBalance = await connection.getBalance(wallet.publicKey);

  if (currentBalance >= minimumLamports) {
    return currentBalance;
  }

  const transferAmount = minimumLamports - currentBalance;
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: admin.publicKey,
      toPubkey: wallet.publicKey,
      lamports: transferAmount,
    })
  );

  await sendAndConfirmTransaction(connection, tx, [admin], {
    commitment: "confirmed",
  });

  return connection.getBalance(wallet.publicKey);
}

async function ensureMintExists(connection, admin, config) {
  const expectedAddress = new PublicKey(config.address);

  if (isOfficialDevnetMint(config.address)) {
    const existing = await connection.getAccountInfo(expectedAddress);
    if (!existing) {
      throw new Error(`Official mint ${config.address} was not found on devnet`);
    }

    return expectedAddress;
  }

  const mintKeypair = readKeypair(config.keypairPath);

  if (!mintKeypair.publicKey.equals(expectedAddress)) {
    throw new Error(
      `Mint keypair ${config.keypairPath} does not match ${config.address}`
    );
  }

  const existing = await connection.getAccountInfo(expectedAddress);
  if (!existing) {
    await createMint(
      connection,
      admin,
      admin.publicKey,
      null,
      6,
      mintKeypair
    );
  }

  return expectedAddress;
}

async function ensureTokenBalance(
  connection,
  admin,
  mint,
  owner,
  targetAmount,
  options = {}
) {
  const {
    mintAuthorityAvailable = true,
    assetLabel = mint.toBase58(),
  } = options;
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    admin,
    mint,
    owner
  );
  const currentAmount = toBigInt((await connection.getTokenAccountBalance(ata.address)).value.amount);

  if (currentAmount < targetAmount) {
    const shortfall = targetAmount - currentAmount;

    if (mintAuthorityAvailable) {
      await mintTo(
        connection,
        admin,
        mint,
        ata.address,
        admin,
        shortfall
      );
    } else {
      const adminAta = await getOrCreateAssociatedTokenAccount(
        connection,
        admin,
        mint,
        admin.publicKey
      );
      const adminAmount = toBigInt(
        (await connection.getTokenAccountBalance(adminAta.address)).value.amount
      );

      if (owner.equals(admin.publicKey)) {
        throw new Error(
          `Admin wallet ${admin.publicKey.toBase58()} needs ${(Number(shortfall) / Number(ONE_TOKEN)).toFixed(2)} more ${assetLabel}. Fund it from ${CIRCLE_FAUCET_URL} and rerun the seed script.`
        );
      }

      if (adminAmount < shortfall) {
        throw new Error(
          `Admin wallet ${admin.publicKey.toBase58()} does not have enough ${assetLabel} to seed ${owner.toBase58()}. Top up the admin wallet from ${CIRCLE_FAUCET_URL} and rerun the seed script.`
        );
      }

      await transferChecked(
        connection,
        admin,
        adminAta.address,
        mint,
        ata.address,
        admin,
        shortfall,
        6
      );
    }
  }

  return ata.address;
}

async function ensureProtocolInitialized(program, admin) {
  const config = deriveProtocolConfigPda();
  const kycRegistry = deriveKycRegistryPda();
  const existing = await program.provider.connection.getAccountInfo(config);

  if (!existing) {
    await program.methods
      .initializeProtocol(50, admin.publicKey, admin.publicKey)
      .accountsPartial({
        config,
        kycRegistry,
        payer: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
  }

  return { config, kycRegistry };
}

async function ensureInstitutionOnChain(program, configPda, kycRegistryPda, institution) {
  const kycRecord = deriveKycRecordPda(institution.onChainId);
  const existing = await program.provider.connection.getAccountInfo(kycRecord);
  const expiry = new BN(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60);

  if (!existing) {
    await program.methods
      .registerInstitution(
        institution.onChainId,
        institution.wallet.publicKey,
        institution.tier,
        institution.jurisdiction,
        institution.vaspId,
        expiry
      )
      .accountsPartial({
        config: configPda,
        kycRegistry: kycRegistryPda,
        kycRecord,
        admin: institution.admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([institution.admin])
      .rpc();
  } else {
    await program.methods
      .updateKycRecord(institution.onChainId, institution.tier, expiry, 0)
      .accountsPartial({
        config: configPda,
        kycRecord,
        admin: institution.admin.publicKey,
      })
      .signers([institution.admin])
      .rpc();
  }

  institution.kycRecord = kycRecord;
}

async function ensureFxVenue(program, admin, usdcMint, venueConfig, mint) {
  const fxVenue = deriveFxVenuePda(usdcMint, mint);
  const existing = await program.provider.connection.getAccountInfo(fxVenue);

  if (existing) {
    return {
      fxVenue,
      fxVaultBase: deriveFxVaultBasePda(fxVenue),
      fxVaultQuote: deriveFxVaultQuotePda(fxVenue),
    };
  }

  const adminBaseAccount = await ensureTokenBalance(
    program.provider.connection,
    admin,
    usdcMint,
    admin.publicKey,
    venueConfig.baseLiquidity + 2n * ONE_TOKEN,
    {
      mintAuthorityAvailable: canAdminMint(MINTS.USDC),
      assetLabel: "USDC",
    }
  );
  const adminQuoteAccount = await ensureTokenBalance(
    program.provider.connection,
    admin,
    mint,
    admin.publicKey,
    venueConfig.quoteLiquidity + 2n * ONE_TOKEN,
    {
      mintAuthorityAvailable: canAdminMint(venueConfig),
      assetLabel: Object.entries(MINTS).find(
        ([, config]) => config.address === venueConfig.address
      )?.[0] ?? "settlement asset",
    }
  );

  await program.methods
    .initializeFxVenue(
      venueConfig.venueId,
      25,
      new BN(venueConfig.sixBfiRate),
      250,
      new BN(venueConfig.baseLiquidity.toString()),
      new BN(venueConfig.quoteLiquidity.toString())
    )
    .accountsPartial({
      config: deriveProtocolConfigPda(),
      fxVenue,
      fxVaultBase: deriveFxVaultBasePda(fxVenue),
      fxVaultQuote: deriveFxVaultQuotePda(fxVenue),
      adminBaseAccount,
      adminQuoteAccount,
      baseMint: usdcMint,
      quoteMint: mint,
      admin: admin.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([admin])
    .rpc();

  return {
    fxVenue,
    fxVaultBase: deriveFxVaultBasePda(fxVenue),
    fxVaultQuote: deriveFxVaultQuotePda(fxVenue),
  };
}

async function getOptionalPrisma() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    return prisma;
  } catch {
    await prisma.$disconnect().catch(() => undefined);
    return null;
  }
}

async function syncInstitutionDb(prisma, institution) {
  if (!prisma) {
    return;
  }

  institution.dbRecord = await prisma.institution.upsert({
    where: { wallet: institution.wallet.publicKey.toBase58() },
    create: {
      wallet: institution.wallet.publicKey.toBase58(),
      name: institution.name,
      entityType: institution.entityType,
      regulatorName: institution.regulatorName,
      lei: institution.onChainId,
      jurisdiction: institution.jurisdiction,
      kycTier: institution.tier,
      kycVerifiedAt: new Date(),
      kycExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true,
      travelRuleVaspId: institution.vaspId,
      travelRuleVaspName: institution.travelRuleVaspName,
      travelRuleProtocol: institution.travelRuleProtocol,
      contactEmail: institution.contactEmail,
      onboardingCompletedAt: new Date(),
      lastLoginAt: new Date(),
    },
    update: {
      name: institution.name,
      entityType: institution.entityType,
      regulatorName: institution.regulatorName,
      lei: institution.onChainId,
      jurisdiction: institution.jurisdiction,
      kycTier: institution.tier,
      kycVerifiedAt: new Date(),
      kycExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true,
      travelRuleVaspId: institution.vaspId,
      travelRuleVaspName: institution.travelRuleVaspName,
      travelRuleProtocol: institution.travelRuleProtocol,
      contactEmail: institution.contactEmail,
      onboardingCompletedAt: new Date(),
      lastLoginAt: new Date(),
    },
  });
}

function buildTradeParams(blueprint, importer, exporter, settlementMint) {
  const documentHash = sha256Bytes(blueprint.documentLabel);

  return {
    depositAmountRaw: BigInt(blueprint.depositAmountUsd) * ONE_TOKEN,
    documentHash,
    condition: {
      conditionType: { documentHash: {} },
      description: `Seed proof for ${blueprint.transactionReference}`,
      documentHash,
      oracleFeed: null,
      oracleExpectedValue: null,
      deadline: null,
      isSatisfied: false,
      satisfiedAt: null,
      satisfiedBy: null,
      releaseBps: 10_000,
    },
    travelRuleData: {
      originatorName: importer.name,
      originatorAccount: `${importer.key.toUpperCase()}-OPS-001`,
      beneficiaryName: exporter.name,
      beneficiaryAccount: `${exporter.key.toUpperCase()}-OPS-001`,
      transactionReference: blueprint.transactionReference,
    },
    params: {
      exporter: exporter.wallet.publicKey,
      exporterInstitutionId: exporter.onChainId,
      settlementCurrencyMint: settlementMint,
      fxRateBandBps: 125,
      conditions: [
        {
          conditionType: { documentHash: {} },
          description: `Seed proof for ${blueprint.transactionReference}`,
          documentHash,
          oracleFeed: null,
          oracleExpectedValue: null,
          deadline: null,
          isSatisfied: false,
          satisfiedAt: null,
          satisfiedBy: null,
          releaseBps: 10_000,
        },
      ],
      disputeWindowHours: blueprint.disputeWindowHours,
      expiresAt: new BN(Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60),
      sourceOfFundsHash: documentHash,
      travelRuleData: {
        originatorName: importer.name,
        originatorAccount: `${importer.key.toUpperCase()}-OPS-001`,
        beneficiaryName: exporter.name,
        beneficiaryAccount: `${exporter.key.toUpperCase()}-OPS-001`,
        transactionReference: blueprint.transactionReference,
      },
    },
  };
}

async function syncEscrowToDb(prisma, blueprint, importer, exporter, settlementMint, onChainEscrow, travelRuleLogPda, transactionHash, venueRate) {
  if (!prisma || !importer.dbRecord || !exporter.dbRecord) {
    return;
  }

  const onChainPda = deriveEscrowPda(blueprint.escrowId).toBase58();
  const depositAmount = toBigInt(onChainEscrow.depositAmount);
  const settledAt = unixSecondsToDate(onChainEscrow.settledAt);
  const status = statusLabel(onChainEscrow.status);

  const escrow = await prisma.escrow.upsert({
    where: { onChainPda },
    create: {
      escrowSeed: blueprint.escrowId,
      onChainPda,
      importerInstitutionId: importer.dbRecord.id,
      exporterInstitutionId: exporter.dbRecord.id,
      depositAmount,
      tokenMint: MINTS.USDC.address,
      settlementMint: settlementMint.toBase58(),
      status,
      conditionsTotal: onChainEscrow.conditions.length,
      conditionsSatisfied: onChainEscrow.conditions.filter((item) => item.isSatisfied).length,
      fxRate: venueRate,
      travelRuleLogPda,
      sourceOfFundsHash: Buffer.from(onChainEscrow.sourceOfFundsHash).toString("hex"),
      expiresAt: unixSecondsToDate(onChainEscrow.expiresAt),
      settledAt,
    },
    update: {
      escrowSeed: blueprint.escrowId,
      importerInstitutionId: importer.dbRecord.id,
      exporterInstitutionId: exporter.dbRecord.id,
      depositAmount,
      tokenMint: MINTS.USDC.address,
      settlementMint: settlementMint.toBase58(),
      status,
      conditionsTotal: onChainEscrow.conditions.length,
      conditionsSatisfied: onChainEscrow.conditions.filter((item) => item.isSatisfied).length,
      fxRate: venueRate,
      travelRuleLogPda,
      sourceOfFundsHash: Buffer.from(onChainEscrow.sourceOfFundsHash).toString("hex"),
      expiresAt: unixSecondsToDate(onChainEscrow.expiresAt),
      settledAt,
    },
    include: {
      importer: true,
      exporter: true,
    },
  });

  await prisma.travelRuleLog.upsert({
    where: { onChainLogPda: travelRuleLogPda },
    create: {
      onChainLogPda: travelRuleLogPda,
      escrowId: escrow.id,
      originatorInstitutionId: importer.dbRecord.id,
      originatorName: importer.name,
      originatorAccount: `${importer.key.toUpperCase()}-OPS-001`,
      beneficiaryInstitutionId: exporter.dbRecord.id,
      beneficiaryName: exporter.name,
      beneficiaryAccount: `${exporter.key.toUpperCase()}-OPS-001`,
      transferAmount: depositAmount,
      currency: "USDC",
      transactionHash: transactionHash ?? null,
    },
    update: {
      escrowId: escrow.id,
      originatorInstitutionId: importer.dbRecord.id,
      originatorName: importer.name,
      originatorAccount: `${importer.key.toUpperCase()}-OPS-001`,
      beneficiaryInstitutionId: exporter.dbRecord.id,
      beneficiaryName: exporter.name,
      beneficiaryAccount: `${exporter.key.toUpperCase()}-OPS-001`,
      transferAmount: depositAmount,
      currency: "USDC",
      transactionHash: transactionHash ?? null,
    },
  });
}

async function ensureTrade(program, admin, prisma, institutions, mints, blueprint) {
  const importer = institutions[blueprint.importer];
  const exporter = institutions[blueprint.exporter];
  const settlementMint = mints[blueprint.settlementCode];
  const venueRate = Number(MINTS[blueprint.settlementCode].sixBfiRate) / 1e8;
  const trade = buildTradeParams(blueprint, importer, exporter, settlementMint);

  const escrowPda = deriveEscrowPda(blueprint.escrowId);
  const vaultPda = deriveVaultPda(blueprint.escrowId);
  const travelRuleLogPda = deriveTravelRuleLogPda(blueprint.travelRuleLogId).toBase58();
  const fxVenue = deriveFxVenuePda(new PublicKey(MINTS.USDC.address), settlementMint);
  const fxVaultBase = deriveFxVaultBasePda(fxVenue);
  const fxVaultQuote = deriveFxVaultQuotePda(fxVenue);

  const importerUsdc = await ensureTokenBalance(
    program.provider.connection,
    admin,
    new PublicKey(MINTS.USDC.address),
    importer.wallet.publicKey,
    trade.depositAmountRaw + 1n * ONE_TOKEN,
    {
      mintAuthorityAvailable: canAdminMint(MINTS.USDC),
      assetLabel: "USDC",
    }
  );
  const exporterSettlement = await ensureTokenBalance(
    program.provider.connection,
    admin,
    settlementMint,
    exporter.wallet.publicKey,
    0n,
    {
      mintAuthorityAvailable: canAdminMint(MINTS[blueprint.settlementCode]),
      assetLabel: blueprint.settlementCode,
    }
  );
  const treasuryAccount = await ensureTokenBalance(
    program.provider.connection,
    admin,
    settlementMint,
    admin.publicKey,
    0n,
    {
      mintAuthorityAvailable: canAdminMint(MINTS[blueprint.settlementCode]),
      assetLabel: blueprint.settlementCode,
    }
  );

  let latestSignature = null;
  let onChainEscrow = await program.account.escrowAccount.fetchNullable(escrowPda);

  if (!onChainEscrow) {
    latestSignature = await program.methods
      .createEscrow(
        blueprint.escrowId,
        new BN(trade.depositAmountRaw.toString()),
        trade.params,
        importer.onChainId
      )
      .accountsPartial({
        config: deriveProtocolConfigPda(),
        escrow: escrowPda,
        vaultTokenAccount: vaultPda,
        tokenMint: new PublicKey(MINTS.USDC.address),
        importerKyc: importer.kycRecord,
        exporterKyc: exporter.kycRecord,
        importer: importer.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([importer.wallet])
      .rpc();

    onChainEscrow = await program.account.escrowAccount.fetch(escrowPda);
  }

  if (statusKey(onChainEscrow.status) === "created") {
    latestSignature = await program.methods
      .fundEscrow(blueprint.escrowId, new BN(trade.depositAmountRaw.toString()))
      .accountsPartial({
        escrow: escrowPda,
        importerTokenAccount: importerUsdc,
        vaultTokenAccount: vaultPda,
        tokenMint: new PublicKey(MINTS.USDC.address),
        importer: importer.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([importer.wallet])
      .rpc();

    onChainEscrow = await program.account.escrowAccount.fetch(escrowPda);
  }

  if (
    ["ready", "dispute", "settled", "refunded"].includes(blueprint.mode) &&
    !["conditionsSatisfied", "inDispute", "settled", "refunded"].includes(
      statusKey(onChainEscrow.status)
    )
  ) {
    latestSignature = await program.methods
      .submitCondition(blueprint.escrowId, {
        conditionIndex: 0,
        documentHash: trade.documentHash,
        oracleValue: null,
        approverSignatures: [],
        proofTimestamp: new BN(Math.floor(Date.now() / 1000)),
        metadataUri: `nexus://seed/${blueprint.escrowId}`,
      })
      .accountsPartial({
        escrow: escrowPda,
        submitter: importer.wallet.publicKey,
      })
      .signers([importer.wallet])
      .rpc();

    onChainEscrow = await program.account.escrowAccount.fetch(escrowPda);
  }

  if (
    blueprint.mode === "dispute" &&
    statusKey(onChainEscrow.status) === "conditionsSatisfied"
  ) {
    latestSignature = await program.methods
      .disputeEscrow(
        blueprint.escrowId,
        `Seeded dispute flow for ${blueprint.transactionReference}`
      )
      .accountsPartial({
        escrow: escrowPda,
        importer: importer.wallet.publicKey,
      })
      .signers([importer.wallet])
      .rpc();

    onChainEscrow = await program.account.escrowAccount.fetch(escrowPda);
  }

  if (
    blueprint.mode === "settled" &&
    statusKey(onChainEscrow.status) === "conditionsSatisfied"
  ) {
    await sleep(1_200);
    latestSignature = await program.methods
      .executeSettlement(
        blueprint.escrowId,
        blueprint.travelRuleLogId,
        {
          quoteId: null,
          maxSlippageBps: 200,
          executionMode: { ammPool: {} },
        },
        importer.name,
        `${importer.key.toUpperCase()}-OPS-001`,
        exporter.name,
        `${exporter.key.toUpperCase()}-OPS-001`,
        blueprint.transactionReference,
        new BN(Date.now())
      )
      .accountsPartial({
        config: deriveProtocolConfigPda(),
        escrow: escrowPda,
        vaultTokenAccount: vaultPda,
        fxVenue,
        fxVaultBase,
        fxVaultQuote,
        exporterSettlementAccount: exporterSettlement,
        treasuryAccount,
        tokenMint: new PublicKey(MINTS.USDC.address),
        settlementMint,
        importerKyc: importer.kycRecord,
        exporterKyc: exporter.kycRecord,
        travelRuleLog: deriveTravelRuleLogPda(blueprint.travelRuleLogId),
        settler: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    onChainEscrow = await program.account.escrowAccount.fetch(escrowPda);
  }

  if (
    blueprint.mode === "refunded" &&
    statusKey(onChainEscrow.status) === "conditionsSatisfied"
  ) {
    latestSignature = await program.methods
      .disputeEscrow(
        blueprint.escrowId,
        `Seeded dispute flow for ${blueprint.transactionReference}`
      )
      .accountsPartial({
        escrow: escrowPda,
        importer: importer.wallet.publicKey,
      })
      .signers([importer.wallet])
      .rpc();

    onChainEscrow = await program.account.escrowAccount.fetch(escrowPda);
  }

  if (
    blueprint.mode === "refunded" &&
    statusKey(onChainEscrow.status) === "inDispute"
  ) {
    latestSignature = await program.methods
      .resolveDispute(blueprint.escrowId, { importerWins: {} })
      .accountsPartial({
        config: deriveProtocolConfigPda(),
        escrow: escrowPda,
        vaultTokenAccount: vaultPda,
        importerTokenAccount: importerUsdc,
        tokenMint: new PublicKey(MINTS.USDC.address),
        admin: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([admin])
      .rpc();

    onChainEscrow = await program.account.escrowAccount.fetch(escrowPda);
  }

  await syncEscrowToDb(
    prisma,
    blueprint,
    importer,
    exporter,
    settlementMint,
    onChainEscrow,
    travelRuleLogPda,
    latestSignature,
    venueRate
  );

  return {
    escrowId: blueprint.escrowId,
    pda: escrowPda.toBase58(),
    status: statusLabel(onChainEscrow.status),
  };
}

async function seedComplianceRows(prisma, institutions) {
  if (!prisma) {
    return;
  }

  const atlas = institutions.atlas.dbRecord;
  const cedar = institutions.cedar.dbRecord;
  const meridian = institutions.meridian.dbRecord;

  if (!atlas || !cedar || !meridian) {
    return;
  }

  if (
    (await prisma.amlScreening.count({
      where: { institutionId: atlas.id },
    })) === 0
  ) {
    await prisma.amlScreening.createMany({
      data: [
        {
          wallet: institutions.atlas.wallet.publicKey.toBase58(),
          institutionId: atlas.id,
          riskScore: 0,
          isSanctioned: false,
          riskCategories: [],
          recommendation: "CLEAR",
          provider: "CHAINALYSIS",
        },
        {
          wallet: institutions.cedar.wallet.publicKey.toBase58(),
          institutionId: cedar.id,
          riskScore: 2,
          isSanctioned: false,
          riskCategories: ["cross-border"],
          recommendation: "REVIEW",
          provider: "CHAINALYSIS",
        },
        {
          wallet: institutions.meridian.wallet.publicKey.toBase58(),
          institutionId: meridian.id,
          riskScore: 1,
          isSanctioned: false,
          riskCategories: [],
          recommendation: "CLEAR",
          provider: "CHAINALYSIS",
        },
      ],
    });
  }

  const kytSamples = [
    {
      txHash: "seed-kyt-atlas-001",
      institutionId: atlas.id,
      riskLevel: "LOW",
      flags: { corridor: "USD/NGN", note: "Seeded clearance event" },
      score: 1.2,
      recommendation: "CLEAR",
      resolvedAt: new Date(),
    },
    {
      txHash: "seed-kyt-cedar-001",
      institutionId: cedar.id,
      riskLevel: "MEDIUM",
      flags: { corridor: "USD/GBP", note: "Seeded review event" },
      score: 4.6,
      recommendation: "REVIEW",
      resolvedAt: null,
    },
  ];

  for (const sample of kytSamples) {
    const existing = await prisma.kytEvent.findFirst({
      where: { txHash: sample.txHash },
    });

    if (!existing) {
      await prisma.kytEvent.create({ data: sample });
    }
  }
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const admin = readKeypair(ADMIN_KEYPAIR_PATH);
  const provider = new AnchorProvider(
    connection,
    createAnchorWallet(admin),
    AnchorProvider.defaultOptions()
  );
  const program = new Program(nexusIdl, provider);
  const prisma = await getOptionalPrisma();

  try {
    const adminBalance = await connection.getBalance(admin.publicKey);
    if (adminBalance < 2 * 1_000_000_000) {
      throw new Error(
        `Admin wallet ${admin.publicKey.toBase58()} has insufficient SOL: ${adminBalance / 1_000_000_000}`
      );
    }

    const mintedAddresses = {};
    for (const [code, config] of Object.entries(MINTS)) {
      mintedAddresses[code] = await ensureMintExists(connection, admin, config);
    }

    const institutions = {};
    for (const seed of Object.values(INSTITUTIONS)) {
      const wallet = readKeypair(seed.walletPath);
      await ensureWalletBalance(connection, admin, wallet, 400_000_000);
      institutions[seed.key] = {
        ...seed,
        wallet,
        admin,
        dbRecord: null,
        kycRecord: null,
      };
    }

    const { config, kycRegistry } = await ensureProtocolInitialized(program, admin);

    for (const institution of Object.values(institutions)) {
      await ensureInstitutionOnChain(program, config, kycRegistry, institution);
      await syncInstitutionDb(prisma, institution);
      await ensureTokenBalance(
        connection,
        admin,
        mintedAddresses.USDC,
        institution.wallet.publicKey,
        1n * ONE_TOKEN,
        {
          mintAuthorityAvailable: canAdminMint(MINTS.USDC),
          assetLabel: "USDC",
        }
      );
    }

    const settlementCodes = [
      ...new Set(TRADE_BLUEPRINTS.map((blueprint) => blueprint.settlementCode)),
    ];

    for (const code of settlementCodes) {
      await ensureFxVenue(
        program,
        admin,
        mintedAddresses.USDC,
        MINTS[code],
        mintedAddresses[code]
      );
    }

    const tradeSummaries = [];
    for (const blueprint of TRADE_BLUEPRINTS) {
      tradeSummaries.push(
        await ensureTrade(program, admin, prisma, institutions, mintedAddresses, blueprint)
      );
    }

    await seedComplianceRows(prisma, institutions);

    console.log(JSON.stringify({
      programId: PROGRAM_ID.toBase58(),
      admin: admin.publicKey.toBase58(),
      mints: Object.fromEntries(
        Object.entries(mintedAddresses).map(([code, mint]) => [code, mint.toBase58()])
      ),
      institutions: Object.fromEntries(
        Object.values(institutions).map((institution) => [
          institution.key,
          {
            onChainId: institution.onChainId,
            wallet: institution.wallet.publicKey.toBase58(),
            dbId: institution.dbRecord?.id ?? null,
            kycRecord: institution.kycRecord.toBase58(),
          },
        ])
      ),
      trades: tradeSummaries,
    }, null, 2));
  } finally {
    await prisma?.$disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
