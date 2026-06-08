import { dltGet, dltTx } from "../client";

export type PledgeCreate = {
  bondId: string; pledgor: string; pledgee: string; amount: number; expiryDate: number;
};
export type PledgeDetail = {
  pledgeId: string; bondId: string; pledgor: string; pledgee: string;
  amount: string; expiryDate: string; status: number;
};

export const pledge = {
  create: (b: PledgeCreate) =>
    dltTx<{ pledgeId: string }>(`/pledge/create`, b),

  release: (pledgeId: string) =>
    dltTx<{ ok: boolean }>(`/pledge/release`, { pledgeId }),

  enforce: (pledgeId: string) =>
    dltTx<{ ok: boolean }>(`/pledge/enforce`, { pledgeId }),

  lastId: () =>
    dltGet<{ pledgeId: string }>(`/pledge/last-id`),

  get: (pledgeId: string) =>
    dltGet<PledgeDetail>(`/pledge/${pledgeId}`),
};
