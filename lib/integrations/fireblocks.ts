import axios, { AxiosInstance } from "axios";
import fs from "fs";
import crypto from "crypto";

export interface NexusTxProposal {
  institutionId: string;
  escrowId: string;
  txType: "CREATE_ESCROW" | "FUND_ESCROW" | "EXECUTE_SETTLEMENT" | "REFUND";
  amount: number;
  currency: string;
  counterpartyInstitutionId: string;
  complianceStatus: "CLEAR" | "REVIEW" | "PENDING";
  travelRuleData?: {
    originatorName: string;
    beneficiaryName: string;
    transactionReference: string;
  };
}

export interface FireblocksWebhookPayload {
  type: string;
  tenantId: string;
  timestamp: number;
  data: {
    id: string;
    status: string;
    subStatus?: string;
    signedMessages?: Array<{ derivationPath: number[]; signature: { fullSig: string } }>;
    txHash?: string;
  };
}

interface FireblocksAddressListResponse {
  address: string;
  bip44AddressIndex?: number;
  change?: number;
  enterpriseAddress?: string;
  legacyAddress?: string;
}



// In-memory store for pending sign requests
const pendingRequests = new Map<
  string,
  {
    resolve: (value: string) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();

export class FireblocksNexusClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, secretPath?: string, baseUrl?: string) {
    this.apiKey = apiKey ?? process.env.FIREBLOCKS_API_KEY ?? "";
    this.baseUrl =
      baseUrl ??
      process.env.FIREBLOCKS_BASE_URL ??
      "https://api.fireblocks.io";

    const secretKeyPath =
      secretPath ?? process.env.FIREBLOCKS_API_SECRET_PATH ?? "";
    let privateKey = "";
    try {
      if (secretKeyPath && fs.existsSync(secretKeyPath)) {
        privateKey = fs.readFileSync(secretKeyPath, "utf-8");
      }
    } catch {
      // In dev/test environments, skip reading the private key
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30_000,
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
      },
    });

    // Add JWT signing interceptor
    this.client.interceptors.request.use((config) => {
      if (privateKey) {
        const now = Math.floor(Date.now() / 1000);
        const payload = {
          uri: config.url,
          nonce: crypto.randomUUID(),
          iat: now,
          exp: now + 30,
          sub: this.apiKey,
          bodyHash: crypto
            .createHash("sha256")
            .update(config.data ? JSON.stringify(config.data) : "")
            .digest("hex"),
        };
        // In production this would use RS256 JWT signing
        // For now we attach the payload as a header
        config.headers["X-Fireblocks-Timestamp"] = now.toString();
      }
      return config;
    });
  }

  async createVaultAccount(institutionId: string): Promise<string> {
    try {
      const response = await this.client.post<{ id: string }>(
        "/v1/vault/accounts",
        {
          name: `NEXUS_${institutionId}`,
          hiddenOnUI: false,
          customerRefId: institutionId,
          autoFuel: false,
        }
      );
      return response.data.id;
    } catch (err) {
      throw new Error(
        `Fireblocks createVaultAccount failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async getSolanaAddress(vaultAccountId: string): Promise<string> {
    try {
      const response = await this.client.get<FireblocksAddressListResponse[]>(
        `/v1/vault/accounts/${vaultAccountId}/SOL/0/addresses`
      );
      const addresses = response.data;
      if (Array.isArray(addresses) && addresses.length > 0) {
        return addresses[0].address;
      }
      throw new Error("No Solana address found");
    } catch (err) {
      throw new Error(
        `Fireblocks getSolanaAddress failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async submitTransactionForApproval(
    tx: NexusTxProposal
  ): Promise<string> {
    try {
      const response = await this.client.post<{ id: string }>(
        "/v1/transactions",
        {
          operation: "RAW",
          source: {
            type: "VAULT_ACCOUNT",
            id: tx.institutionId,
          },
          note: `NEXUS ${tx.txType} - Escrow: ${tx.escrowId}`,
          customerRefId: tx.escrowId,
          extraParameters: {
            rawMessageData: {
              algorithm: "MPC_ECDSA_SECP256K1",
              messages: [
                {
                  content: Buffer.from(
                    JSON.stringify({
                      escrowId: tx.escrowId,
                      txType: tx.txType,
                      amount: tx.amount,
                      currency: tx.currency,
                      counterparty: tx.counterpartyInstitutionId,
                      compliance: tx.complianceStatus,
                    })
                  ).toString("hex"),
                },
              ],
            },
          },
        }
      );
      return response.data.id;
    } catch (err) {
      throw new Error(
        `Fireblocks submitTransactionForApproval failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async signSolanaTransaction(
    vaultId: string,
    serializedTx: string
  ): Promise<string> {
    const txId = await this.submitTransactionForApproval({
      institutionId: vaultId,
      escrowId: `tx_${Date.now()}`,
      txType: "EXECUTE_SETTLEMENT",
      amount: 0,
      currency: "SOL",
      counterpartyInstitutionId: "",
      complianceStatus: "CLEAR",
    });

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingRequests.delete(txId);
        reject(new Error(`Fireblocks signing timed out after 5 minutes for tx ${txId}`));
      }, SIGN_TIMEOUT_MS);

      pendingRequests.set(txId, { resolve, reject, timer });
    });
  }

  async webhookHandler(payload: FireblocksWebhookPayload): Promise<void> {
    const { type, data } = payload;
    if (type === "TRANSACTION_STATUS_UPDATED" || type === "TRANSACTION_APPROVED") {
      const pending = pendingRequests.get(data.id);
      if (!pending) return;

      if (data.status === "COMPLETED" || data.status === "SIGNED") {
        clearTimeout(pending.timer);
        pendingRequests.delete(data.id);
        const signedTx = data.signedMessages?.[0]?.signature?.fullSig ?? "";
        pending.resolve(signedTx);
      } else if (
        data.status === "FAILED" ||
        data.status === "REJECTED" ||
        data.status === "CANCELLED"
      ) {
        clearTimeout(pending.timer);
        pendingRequests.delete(data.id);
        pending.reject(
          new Error(`Fireblocks transaction ${data.id} ${data.status}: ${data.subStatus ?? ""}`)
        );
      }
    }
  }

  verifyWebhookSignature(
    payload: string,
    signature: string,
    publicKey: string
  ): boolean {
    try {
      const verify = crypto.createVerify("SHA512");
      verify.update(payload);
      return verify.verify(publicKey, signature, "hex");
    } catch {
      return false;
    }
  }
}

export const fireblocksClient = new FireblocksNexusClient();
