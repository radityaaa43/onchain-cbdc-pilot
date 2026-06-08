import { dltGet, dltTx } from "../client";

export const cbdcReads = {
  allowance: (owner: string, spender: string) =>
    dltGet<{ owner: string; spender: string; allowance: string }>(`/cbdc/allowance/${owner}/${spender}`),
  approve: (b: { spender: string; amount: number }) => dltTx<{ ok: boolean }>(`/cbdc/approve`, b),
};
