import { dltGet, dltTx } from "../client";

export const bondOps = {
  redeem: (b: { bondId: string; holder: string; amount: number }) => dltTx<{ ok: boolean }>(`/bond-redemption/redeem`, b),
  funding: (bondId: string) => dltGet<{ bondId: string; sufficient: boolean; required: string; available: string }>(`/bond-redemption/funding/${bondId}`),
  transfer: (b: { bondId: string; from: string; to: string; amount: number; data?: string }) => dltTx<{ ok: boolean }>(`/bond-transfer/transfer`, { data: "0x", ...b }),
  trackMaturity: (b: { bondId: string }) => dltTx<{ ok: boolean }>(`/maturity-oracle/track`, b),
  triggerMaturityBatch: () => dltTx<{ ok: boolean }>(`/maturity-oracle/trigger-batch`, {}),
  trackedBonds: () => dltGet<{ bonds: string[] }>(`/maturity-oracle/tracked-bonds`),
};
