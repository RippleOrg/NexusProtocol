import { useState, useCallback } from "react";

export type SettlementStep =
  | "idle"
  | "aml_check"
  | "rate_validation"
  | "travel_rule"
  | "atomic_execution"
  | "success"
  | "error";

export interface SettlementState {
  step: SettlementStep;
  elapsedMs: number;
  settlementMs?: number;
  settlementAmount?: number;
  fxRate?: number;
  error?: string;
}

export function useSettlement() {
  const [state, setState] = useState<SettlementState>({
    step: "idle",
    elapsedMs: 0,
  });

  const executeSettlement = useCallback(
    async (escrowId: string, logId: string) => {
      const startMs = Date.now();

      // Timer
      const timer = setInterval(() => {
        setState((prev) => ({
          ...prev,
          elapsedMs: Date.now() - startMs,
        }));
      }, 50);

      try {
        // Step 1: AML Check
        setState({ step: "aml_check", elapsedMs: 0 });
        await new Promise((r) => setTimeout(r, 300));

        // Step 2: Rate Validation
        setState((prev) => ({ ...prev, step: "rate_validation" }));
        await new Promise((r) => setTimeout(r, 200));

        // Step 3: Travel Rule
        setState((prev) => ({ ...prev, step: "travel_rule" }));
        await new Promise((r) => setTimeout(r, 150));

        // Step 4: Atomic Execution
        setState((prev) => ({ ...prev, step: "atomic_execution" }));

        // In production: call anchor program execute_settlement instruction
        await new Promise((r) => setTimeout(r, 500));

        const settlementMs = Date.now() - startMs;
        clearInterval(timer);

        setState({
          step: "success",
          elapsedMs: settlementMs,
          settlementMs,
          settlementAmount: 0,
          fxRate: 0,
        });
      } catch (err) {
        clearInterval(timer);
        setState((prev) => ({
          ...prev,
          step: "error",
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ step: "idle", elapsedMs: 0 });
  }, []);

  return { state, executeSettlement, reset };
}
