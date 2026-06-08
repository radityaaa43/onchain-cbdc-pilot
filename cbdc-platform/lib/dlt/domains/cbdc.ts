import { dltGet, dltTx } from "../client";

export const cbdc = {
  balance: (address: string) => dltGet<{ address: string; balance: string }>(`/cbdc/balance/${address}`),
  issuedTotal: () => dltGet<{ total: string }>(`/cbdc/issued-total`),
  issue: (b: { to: string; amount: number }) => dltTx<{ ok: boolean }>(`/cbdc/issue`, b),
  transfer: (b: { from: string; to: string; amount: number }) => dltTx<{ ok: boolean }>(`/cbdc/transfer`, b),
};
