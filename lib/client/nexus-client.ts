"use client";

export interface NexusAuthContext {
  walletAddress?: string | null;
}

export async function nexusFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  auth?: NexusAuthContext
): Promise<T> {
  const headers = new Headers(init?.headers);

  if (auth?.walletAddress) {
    headers.set("x-nexus-wallet-address", auth.walletAddress);
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    const message =
      payload?.error && payload?.message && payload.error !== payload.message
        ? `${payload.error}: ${payload.message}`
        : payload?.error ?? payload?.message ?? "Request failed";

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
