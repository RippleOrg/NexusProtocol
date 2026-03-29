import { Connection } from "@solana/web3.js";
import {
  PUBLIC_DEVNET_RPC_URL,
  SOLANA_READ_RPC_URLS,
} from "@/lib/nexus/constants";

function formatRpcError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function getSolanaReadRpcUrls() {
  return SOLANA_READ_RPC_URLS.length > 0
    ? SOLANA_READ_RPC_URLS
    : [PUBLIC_DEVNET_RPC_URL];
}

export async function withSolanaReadFallback<T>(
  operation: (connection: Connection, rpcUrl: string) => Promise<T>
) {
  const errors: string[] = [];

  for (const rpcUrl of getSolanaReadRpcUrls()) {
    const connection = new Connection(rpcUrl, "confirmed");

    try {
      const value = await operation(connection, rpcUrl);
      return { value, rpcUrl };
    } catch (error) {
      errors.push(`${rpcUrl} -> ${formatRpcError(error)}`);
    }
  }

  throw new Error(
    `All Solana RPC providers failed. ${errors.join(" | ")}`
  );
}
