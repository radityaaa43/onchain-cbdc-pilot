import { dltGet, dltTx } from "../client";

export type FailureRecord = {
  failure: { settlementId: string; reason: number; details: string; timestamp: string; resolved: boolean };
};
export type BuyInRecord = {
  buyIn: { initiated: boolean; executed: boolean; initiatedAt: string; buyInAmount: string; buyInPriceBps: string; costToDefaulter: string };
};

export const settlementFailure = {
  report: (b: { settlementId: string; reason: number; details: string }) =>
    dltTx<{ ok: boolean }>(`/settlement-failure/report`, b),

  retry: (settlementId: string) =>
    dltTx<{ ok: boolean }>(`/settlement-failure/${settlementId}/retry`, {}),

  escalate: (settlementId: string) =>
    dltTx<{ ok: boolean }>(`/settlement-failure/${settlementId}/escalate`, {}),

  buyInInitiate: (settlementId: string) =>
    dltTx<{ ok: boolean }>(`/settlement-failure/${settlementId}/buy-in/initiate`, {}),

  buyInExecute: (b: { settlementId: string; buyInAmount: number; buyInPriceBps: number }) =>
    dltTx<{ ok: boolean }>(`/settlement-failure/buy-in/execute`, b),

  get: (settlementId: string) =>
    dltGet<FailureRecord>(`/settlement-failure/${settlementId}`),

  getBuyIn: (settlementId: string) =>
    dltGet<BuyInRecord>(`/settlement-failure/${settlementId}/buy-in`),
};
