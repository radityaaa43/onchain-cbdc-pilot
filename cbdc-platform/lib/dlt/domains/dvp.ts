import { dltGet, dltTx } from "../client";

export type DvpInitiate = {
  bondId: string; bondSeller: string; bondBuyer: string; bondAmount: number; bondPartition: string;
  cbdcPayer: string; cbdcPayee: string; cbdcAmount: number; model: number;
};

export const dvp = {
  initiate: (b: DvpInitiate) => dltTx<{ settlementId: string }>(`/dvp/initiate`, b),
  fail: (settlementId: string, b: { reason: string }) => dltTx<{ ok: boolean }>(`/dvp/${settlementId}/fail`, b),
  cancel: (settlementId: string, b: { reason: string }) => dltTx<{ ok: boolean }>(`/dvp/${settlementId}/cancel`, b),
  status: (settlementId: string) => dltGet<{ settlement: Record<string, unknown> }>(`/dvp/${settlementId}/status`),
};
