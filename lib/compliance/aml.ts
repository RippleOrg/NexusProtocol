import { chainalysisClient, AmlScreeningResult } from "@/lib/integrations/chainalysis";

export interface AmlCheckResult {
  wallet: string;
  institutionId: string;
  passed: boolean;
  result: AmlScreeningResult;
  flaggedAt?: number;
}

const AML_BLOCK_THRESHOLD = 7; // Risk score >= 7 = BLOCK

export class AmlEngine {
  async checkWallet(
    wallet: string,
    institutionId: string
  ): Promise<AmlCheckResult> {
    const result = await chainalysisClient.screenAddress(wallet);
    const passed =
      !result.isSanctioned && result.riskScore < AML_BLOCK_THRESHOLD;

    return {
      wallet,
      institutionId,
      passed,
      result,
      flaggedAt: passed ? undefined : Date.now(),
    };
  }

  async checkBothParties(
    importerWallet: string,
    importerInstitutionId: string,
    exporterWallet: string,
    exporterInstitutionId: string
  ): Promise<{ importerPassed: boolean; exporterPassed: boolean; results: AmlCheckResult[] }> {
    const [importerCheck, exporterCheck] = await Promise.all([
      this.checkWallet(importerWallet, importerInstitutionId),
      this.checkWallet(exporterWallet, exporterInstitutionId),
    ]);

    return {
      importerPassed: importerCheck.passed,
      exporterPassed: exporterCheck.passed,
      results: [importerCheck, exporterCheck],
    };
  }
}

export const amlEngine = new AmlEngine();
