import { dltGet, dltTx } from "../client";

export const redemption = {
  request: (b: { user: string; amount: number }) => dltTx<{ ok: boolean; requestId: string | null }>(`/redemption/request`, b),
  process: (b: { requestId: string }) => dltTx<{ ok: boolean }>(`/redemption/process`, b),
  get: (requestId: string) => dltGet<{ user: string; amount: string; processed: boolean; timestamp: string }>(`/redemption/request/${requestId}`),
  total: (address: string) => dltGet<{ address: string; total: string }>(`/redemption/total/${address}`),
};
