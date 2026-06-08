import { dltGet, dltTx } from "../client";

export type RepoInitiate = {
  bondId: string; seller: string; buyer: string;
  amount: number; repoRate: number; tenor: number;
};
export type RepoDetail = {
  repoId: string; bondId: string; seller: string; buyer: string;
  amount: string; repoRate: string; haircut: string;
  purchasePrice: string; repurchasePrice: string;
  tenor: string; startDate: string; endDate: string; status: number;
  sellerConsentEarlyTermination: boolean; buyerConsentEarlyTermination: boolean;
  initialMarketPrice: string; marginCallThreshold: string;
  marginCallActive: boolean; marginCallDeadline: string;
};

export const repo = {
  initiate: (b: RepoInitiate) =>
    dltTx<{ repoId: string }>(`/repo/initiate`, b),

  initiateWithHaircut: (b: RepoInitiate & { marketPrice: number; haircut: number; marginCallThreshold: number }) =>
    dltTx<{ repoId: string }>(`/repo/initiate-with-haircut`, b),

  consentEarlyTermination: (repoId: string) =>
    dltTx<{ ok: boolean }>(`/repo/consent-early-termination`, { repoId }),

  terminateEarly: (repoId: string) =>
    dltTx<{ ok: boolean }>(`/repo/terminate-early`, { repoId }),

  unwind: (repoId: string) =>
    dltTx<{ ok: boolean }>(`/repo/unwind`, { repoId }),

  marginCall: (b: { repoId: string; currentMarketPrice: number }) =>
    dltTx<{ ok: boolean }>(`/repo/margin-call`, b),

  marginCallRespond: (b: { repoId: string; amount: number }) =>
    dltTx<{ ok: boolean }>(`/repo/margin-call/respond`, b),

  lastId: () =>
    dltGet<{ repoId: string }>(`/repo/last-id`),

  get: (repoId: string) =>
    dltGet<RepoDetail>(`/repo/${repoId}`),
};
