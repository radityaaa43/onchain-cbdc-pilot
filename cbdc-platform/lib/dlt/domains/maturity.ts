import { dltGet, dltTx } from "../client";

export const maturity = {
  setInfo: (b: { bondId: string; maturityDate: number; finalRedemptionPct: number; principalAmount: number }) =>
    dltTx<{ ok: boolean }>(`/maturity/set-info`, b),
  trigger: (b: { bondId: string }) => dltTx<{ ok: boolean }>(`/maturity/trigger`, b),
  info: (bondId: string) =>
    dltGet<{ bondId: string; maturityDate: string; finalRedemptionPct: string; principalAmount: string }>(
      `/maturity/info/${bondId}`,
    ),
};
