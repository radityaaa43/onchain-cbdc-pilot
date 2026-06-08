import { dltGet, dltTx } from "../client";

export const limits = {
  setBalance: (b: { account: string; limit: number }) => dltTx<{ ok: boolean }>(`/balance-limit/set`, b),
  getBalance: (address: string) => dltGet<{ address: string; limit: string }>(`/balance-limit/${address}`),
  setDaily: (b: { account: string; limit: number }) => dltTx<{ ok: boolean }>(`/daily-limit/set`, b),
  getDaily: (address: string) => dltGet<{ address: string; limit: string }>(`/daily-limit/${address}`),
  getDailySpent: (address: string) => dltGet<{ address: string; spent: string }>(`/daily-limit/${address}/spent`),
};
