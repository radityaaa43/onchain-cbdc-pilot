import { dltGet, dltTx } from "../client";

export const bonds = {
  register: (b: { maturityDate: number }) => dltTx<{ bondId: string }>(`/bonds/register`, b),
  lastId: () => dltGet<{ bondId: string }>(`/bonds/last-id`),
  issue: (bondId: string, b: { investor: string; amount: number }) => dltTx<{ ok: boolean }>(`/bonds/${bondId}/issue`, b),
  balance: (bondId: string, holder: string, state = "PRIMARY") =>
    dltGet<{ bondId: string; balance: string }>(`/bonds/${bondId}/balance?holder=${holder}&state=${state}`),
  matured: (bondId: string) => dltGet<{ bondId: string; matured: boolean }>(`/bonds/${bondId}/matured`),
};
