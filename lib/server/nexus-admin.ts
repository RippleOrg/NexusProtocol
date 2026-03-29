import { readFile } from "fs/promises";
import path from "path";
import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SendTransactionError,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { nexusIdl } from "@/lib/nexus/idl";
import {
  DEVNET_TEST_ASSETS,
  OFFICIAL_CIRCLE_DEVNET_USDC_MINT,
  PROGRAM_ID,
  SOLANA_RPC_URL,
  USDC_MINT,
} from "@/lib/nexus/constants";
import {
  deriveKycRecordPda,
  deriveKycRegistryPda,
  deriveProtocolConfigPda,
} from "@/lib/nexus/onchain";
import type { Nexus } from "@/types/nexus";

type AnchorWallet = ConstructorParameters<typeof AnchorProvider>[1];
const DEFAULT_ADMIN_KEYPAIR_PATH = "./nexus-deployer.json";
const DEFAULT_PROTOCOL_FEE_BPS = 50;
const DEFAULT_WALLET_LIQUIDITY = 500_000n * 1_000_000n;

function createAnchorWallet(keypair: Keypair): AnchorWallet {
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

async function readKeypair(filePath: string) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const secretKey = JSON.parse(
    await readFile(absolutePath, "utf8")
  ) as number[];

  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

async function loadAdminKeypair() {
  const inlineSecretKey = process.env.NEXUS_ADMIN_SECRET_KEY_JSON;

  if (inlineSecretKey) {
    const secretKey = JSON.parse(inlineSecretKey) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(secretKey));
  }

  return readKeypair(
    process.env.NEXUS_ADMIN_KEYPAIR_PATH ?? DEFAULT_ADMIN_KEYPAIR_PATH
  );
}

async function formatSolanaError(error: unknown, connection?: Connection) {
  const baseMessage = error instanceof Error ? error.message : String(error);

  if (error instanceof SendTransactionError && connection) {
    try {
      const logs = await error.getLogs(connection);
      if (logs?.length) {
        return `${baseMessage}. Logs: ${logs.join(" ")}`;
      }
    } catch {
      // Fall back to the base message when logs cannot be loaded.
    }
  }

  return baseMessage;
}

export async function getAdminProgramContext() {
  const adminKeypair = await loadAdminKeypair();
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const provider = new AnchorProvider(
    connection,
    createAnchorWallet(adminKeypair),
    AnchorProvider.defaultOptions()
  );
  const program = new Program<Nexus>(nexusIdl, provider);

  return {
    adminKeypair,
    connection,
    provider,
    program,
  };
}

export async function ensureProtocolInitialized() {
  const { program, provider } = await getAdminProgramContext();
  const config = new PublicKey(deriveProtocolConfigPda());
  const kycRegistry = new PublicKey(deriveKycRegistryPda());
  const existing = await provider.connection.getAccountInfo(config);

  if (existing) {
    return { program, provider, config, kycRegistry };
  }

  const treasury = new PublicKey(
    process.env.NEXUS_TREASURY_WALLET ?? provider.publicKey.toBase58()
  );

  try {
    await program.methods
      .initializeProtocol(
        DEFAULT_PROTOCOL_FEE_BPS,
        provider.publicKey,
        treasury
      )
      .accountsPartial({
        config,
        kycRegistry,
        payer: provider.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  } catch (error) {
    throw new Error(await formatSolanaError(error, provider.connection));
  }

  return { program, provider, config, kycRegistry };
}

export async function registerInstitutionOnChain(params: {
  institutionId: string;
  wallet: string;
  tier: number;
  jurisdiction: string;
  vaspId?: string | null;
  expiresAt: Date;
}) {
  const { institutionId, wallet, tier, jurisdiction, vaspId, expiresAt } =
    params;
  const { program, config, kycRegistry, provider } =
    await ensureProtocolInitialized();
  const kycRecord = new PublicKey(deriveKycRecordPda(institutionId));
  const existing = await provider.connection.getAccountInfo(kycRecord);

  try {
    if (!existing) {
      await program.methods
        .registerInstitution(
          institutionId,
          new PublicKey(wallet),
          tier,
          jurisdiction,
          vaspId ?? "",
          new BN(Math.floor(expiresAt.getTime() / 1000))
        )
        .accountsPartial({
          config,
          kycRegistry,
          kycRecord,
          admin: provider.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } else {
      await program.methods
        .updateKycRecord(
          institutionId,
          tier,
          new BN(Math.floor(expiresAt.getTime() / 1000)),
          null
        )
        .accountsPartial({
          config,
          kycRecord,
          admin: provider.publicKey,
        })
        .rpc();
    }
  } catch (error) {
    throw new Error(await formatSolanaError(error, provider.connection));
  }

  return {
    kycRecordPda: kycRecord.toBase58(),
  };
}

export async function provisionInstitutionLiquidity(
  walletAddress: string,
  rawAmount = DEFAULT_WALLET_LIQUIDITY
) {
  const { adminKeypair, connection } = await getAdminProgramContext();
  const baseMint = new PublicKey(USDC_MINT);
  const owner = new PublicKey(walletAddress);

  if (baseMint.toBase58() === OFFICIAL_CIRCLE_DEVNET_USDC_MINT) {
    return {
      mint: baseMint.toBase58(),
      tokenAccount: null,
      amount: "0",
      faucetRequired: true,
      faucetUrl: "https://faucet.circle.com/",
    };
  }

  try {
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      adminKeypair,
      baseMint,
      owner,
      true
    );
    const currentBalance = await connection.getTokenAccountBalance(
      tokenAccount.address
    );
    const currentAmount = BigInt(currentBalance.value.amount);
    const targetAmount = BigInt(rawAmount);
    const topUpAmount =
      currentAmount >= targetAmount ? 0n : targetAmount - currentAmount;

    if (topUpAmount > 0n) {
      await mintTo(
        connection,
        adminKeypair,
        baseMint,
        tokenAccount.address,
        adminKeypair,
        topUpAmount
      );
    }

    return {
      mint: baseMint.toBase58(),
      tokenAccount: tokenAccount.address.toBase58(),
      amount: topUpAmount.toString(),
    };
  } catch (error) {
    throw new Error(await formatSolanaError(error, connection));
  }
}

export async function getWalletTokenBalance(walletAddress: string) {
  const { connection, adminKeypair } = await getAdminProgramContext();
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    adminKeypair,
    new PublicKey(USDC_MINT),
    new PublicKey(walletAddress),
    true
  );
  const balance = await connection.getTokenAccountBalance(tokenAccount.address);

  return {
    tokenAccount: tokenAccount.address.toBase58(),
    amount: balance.value.amount,
    uiAmount: balance.value.uiAmount ?? 0,
  };
}

export async function mintCustomDevnetAsset(params: {
  code: string;
  walletAddress: string;
  amount: number;
}) {
  const asset = DEVNET_TEST_ASSETS.find((entry) => entry.code === params.code);

  if (!asset) {
    throw new Error(`Unsupported devnet asset: ${params.code}`);
  }

  if (asset.kind !== "custom") {
    throw new Error(`${params.code} is an official asset. Use the public faucet instead.`);
  }

  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new Error("Mint amount must be greater than zero");
  }

  const { adminKeypair, connection } = await getAdminProgramContext();
  const mint = new PublicKey(asset.mint);
  const owner = new PublicKey(params.walletAddress);
  try {
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      adminKeypair,
      mint,
      owner,
      true
    );
    const rawAmount = BigInt(Math.round(params.amount * 1_000_000));
    const signature = await mintTo(
      connection,
      adminKeypair,
      mint,
      tokenAccount.address,
      adminKeypair,
      rawAmount
    );

    return {
      code: asset.code,
      mint: asset.mint,
      tokenAccount: tokenAccount.address.toBase58(),
      amount: rawAmount.toString(),
      uiAmount: params.amount,
      signature,
    };
  } catch (error) {
    throw new Error(await formatSolanaError(error, connection));
  }
}

export function getProgramPublicKey() {
  return new PublicKey(PROGRAM_ID);
}
