import { NextRequest, NextResponse } from "next/server";
import {
  LAMPORTS_PER_SOL,
  ParsedAccountData,
  PublicKey,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { requireWalletSession } from "@/lib/server/wallet-auth";
import { DEVNET_TEST_ASSETS } from "@/lib/nexus/constants";
import { withSolanaReadFallback } from "@/lib/server/solana-rpc";

export async function GET(req: NextRequest) {
  try {
    const session = await requireWalletSession(req);
    const owner = new PublicKey(session.walletAddress);

    const { value, rpcUrl } = await withSolanaReadFallback(async (connection) => {
      const [solLamports, tokenAccounts] = await Promise.all([
        connection.getBalance(owner, "confirmed"),
        connection.getParsedTokenAccountsByOwner(
          owner,
          { programId: TOKEN_PROGRAM_ID },
          "confirmed"
        ),
      ]);

      const balancesByMint = new Map<
        string,
        {
          amount: bigint;
          uiAmount: number;
          decimals: number;
          tokenAccounts: string[];
        }
      >();

      for (const tokenAccount of tokenAccounts.value) {
        const parsed = tokenAccount.account.data as ParsedAccountData;
        const info = parsed.parsed.info as {
          mint: string;
          tokenAmount: {
            amount: string;
            uiAmount: number | null;
            decimals: number;
          };
        };
        const existing = balancesByMint.get(info.mint) ?? {
          amount: 0n,
          uiAmount: 0,
          decimals: info.tokenAmount.decimals,
          tokenAccounts: [],
        };

        balancesByMint.set(info.mint, {
          amount: existing.amount + BigInt(info.tokenAmount.amount),
          uiAmount: existing.uiAmount + (info.tokenAmount.uiAmount ?? 0),
          decimals: info.tokenAmount.decimals,
          tokenAccounts: [...existing.tokenAccounts, tokenAccount.pubkey.toBase58()],
        });
      }

      return {
        solLamports,
        assets: DEVNET_TEST_ASSETS.map((asset) => {
          const balance = balancesByMint.get(asset.mint);

          return {
            code: asset.code,
            label: asset.label,
            kind: asset.kind,
            mint: asset.mint,
            amount: balance?.amount.toString() ?? "0",
            uiAmount: balance?.uiAmount ?? 0,
            decimals: balance?.decimals ?? 6,
            tokenAccounts: balance?.tokenAccounts ?? [],
          };
        }),
      };
    });

    return NextResponse.json({
      walletAddress: session.walletAddress,
      rpcUrl,
      sol: {
        lamports: value.solLamports.toString(),
        amount: value.solLamports / LAMPORTS_PER_SOL,
      },
      assets: value.assets,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /Missing wallet address|Invalid wallet address/i.test(message)
      ? 401
      : /All Solana RPC providers failed/i.test(message)
        ? 503
      : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
