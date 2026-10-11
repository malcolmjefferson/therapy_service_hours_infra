/**
 * Release settings for the single pipeline (ADR-0005): account-level, not per environment.
 */
export const RELEASE = {
  /**
   * Whether the pipeline promotes to prod (release info, manual approval, prod stage). Off until
   * milestone M3 (owner decision 2026-10-11): runs end after the dev smoke test, so no approval
   * waits in the queued pipeline and blocks later dev runs. Turning it on restores the prod stage
   * unchanged (tested).
   */
  deployProd: false,
  /**
   * Account-wide AWS Budget in USD per month, with alerts at 80% and 100% of actual spend and 100%
   * of forecast (SEC-82). One per account, so it lives in the pipeline stack, which is always
   * deployed, rather than in an environment.
   */
  monthlyBudgetUsd: 50,
} as const;
