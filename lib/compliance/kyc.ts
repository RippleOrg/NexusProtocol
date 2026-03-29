import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";

export interface KycVerificationRequest {
  wallet: string;
  institutionId: string;
  tier: 1 | 2 | 3;
  jurisdiction: string;
  vaspId: string;
  expiresAt: Date;
}

export interface KycVerificationResult {
  success: boolean;
  kycRecordPda?: string;
  tier: number;
  message: string;
  faucetRequired?: boolean;
  faucetUrl?: string | null;
}

export class KycEngine {
  async verifyKyc(request: KycVerificationRequest): Promise<KycVerificationResult> {
    try {
      const response = await fetch("/api/kyc/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: request.wallet,
          institutionId: request.institutionId,
          tier: request.tier,
          jurisdiction: request.jurisdiction,
          vaspId: request.vaspId,
          expiresAt: request.expiresAt.toISOString(),
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { message?: string };
        return {
          success: false,
          tier: 0,
          message: error.message ?? "KYC verification failed",
        };
      }

      const data = (await response.json()) as {
        success: boolean;
        kycRecordPda: string;
        tier: number;
        message?: string;
        faucetRequired?: boolean;
        faucetUrl?: string | null;
      };
      return {
        success: data.success,
        kycRecordPda: data.kycRecordPda,
        tier: data.tier,
        message: data.message ?? "KYC verification successful",
        faucetRequired: data.faucetRequired,
        faucetUrl: data.faucetUrl,
      };
    } catch (err) {
      return {
        success: false,
        tier: 0,
        message: `KYC verification error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async getKycStatus(institutionId: string): Promise<{
    isActive: boolean;
    tier: number;
    expiresAt: Date | null;
    jurisdiction: string;
  }> {
    try {
      const response = await fetch(
        `/api/kyc/status?institutionId=${encodeURIComponent(institutionId)}`
      );
      if (!response.ok) {
        return { isActive: false, tier: 0, expiresAt: null, jurisdiction: "" };
      }
      const data = (await response.json()) as {
        isActive: boolean;
        tier: number;
        expiresAt: string | null;
        jurisdiction: string;
      };
      return {
        isActive: data.isActive,
        tier: data.tier,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        jurisdiction: data.jurisdiction,
      };
    } catch {
      return { isActive: false, tier: 0, expiresAt: null, jurisdiction: "" };
    }
  }
}

export const kycEngine = new KycEngine();
