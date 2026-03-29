import { PublicKey } from "@solana/web3.js";
import type { NextRequest } from "next/server";

export interface WalletSession {
  userId: string;
  walletAddress: string;
  email: null;
}

export async function requireWalletSession(
  req: NextRequest
): Promise<WalletSession> {
  const walletAddress = req.headers.get("x-nexus-wallet-address")?.trim() ?? "";

  if (!walletAddress) {
    throw new Error("Missing wallet address");
  }

  try {
    new PublicKey(walletAddress);
  } catch {
    throw new Error("Invalid wallet address");
  }

  return {
    userId: walletAddress,
    walletAddress,
    email: null,
  };
}
