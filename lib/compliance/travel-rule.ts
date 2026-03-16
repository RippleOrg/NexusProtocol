export interface TravelRuleTransfer {
  escrowId: string;
  originatorInstitutionId: string;
  originatorWallet: string;
  originatorName: string;
  originatorAccount: string;
  beneficiaryInstitutionId: string;
  beneficiaryWallet: string;
  beneficiaryName: string;
  beneficiaryAccount: string;
  transferAmountUsd: number;
  currency: string;
  transactionReference: string;
}

export interface TravelRulePayload {
  recordId: string;
  originator: {
    name: string;
    accountNumber: string;
    institutionId: string;
    wallet: string;
    vaspId: string;
  };
  beneficiary: {
    name: string;
    accountNumber: string;
    institutionId: string;
    wallet: string;
    vaspId: string;
  };
  amount: number;
  currency: string;
  transactionReference: string;
  submittedAt: string;
}

export interface TravelRuleReport {
  escrowId: string;
  recordId: string;
  payload: TravelRulePayload;
  onChainLogPda?: string;
  status: "SUBMITTED" | "PENDING" | "FAILED";
  createdAt: string;
}

const TRAVEL_RULE_THRESHOLD_USD = 1_000;

export class TravelRuleEngine {
  requiresTravelRule(amountUsd: number): boolean {
    return amountUsd >= TRAVEL_RULE_THRESHOLD_USD;
  }

  buildTravelRulePayload(transfer: TravelRuleTransfer): TravelRulePayload {
    return {
      recordId: `TR-${transfer.escrowId}-${Date.now()}`,
      originator: {
        name: transfer.originatorName,
        accountNumber: transfer.originatorAccount,
        institutionId: transfer.originatorInstitutionId,
        wallet: transfer.originatorWallet,
        vaspId: transfer.originatorInstitutionId,
      },
      beneficiary: {
        name: transfer.beneficiaryName,
        accountNumber: transfer.beneficiaryAccount,
        institutionId: transfer.beneficiaryInstitutionId,
        wallet: transfer.beneficiaryWallet,
        vaspId: transfer.beneficiaryInstitutionId,
      },
      amount: transfer.transferAmountUsd,
      currency: transfer.currency,
      transactionReference: transfer.transactionReference,
      submittedAt: new Date().toISOString(),
    };
  }

  async submitTravelRuleRecord(
    payload: TravelRulePayload
  ): Promise<string> {
    try {
      // In production, this would call a TRISA/OpenVASP/Notabene endpoint
      // For now we store locally and return the record ID
      const recordId = payload.recordId;
      // Store to database via API call
      const response = await fetch("/api/travel-rule/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Travel rule submission failed: ${response.statusText}`);
      }
      const data = (await response.json()) as { recordId: string };
      return data.recordId ?? recordId;
    } catch (err) {
      throw new Error(
        `TravelRuleEngine.submitTravelRuleRecord failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async generateTravelRuleReport(
    escrowId: string
  ): Promise<TravelRuleReport> {
    try {
      const response = await fetch(
        `/api/travel-rule/report?escrowId=${escrowId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch travel rule report: ${response.statusText}`);
      }
      return (await response.json()) as TravelRuleReport;
    } catch (err) {
      throw new Error(
        `TravelRuleEngine.generateTravelRuleReport failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

export const travelRuleEngine = new TravelRuleEngine();
