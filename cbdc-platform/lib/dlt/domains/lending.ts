import { dltGet, dltTx } from "../client";

export type LendInitiate = {
  bondId: string; lender: string; borrower: string;
  amount: number; feeRateBps: number; tenor: number;
};
export type LendDetail = {
  lendId: string; bondId: string; lender: string; borrower: string;
  amount: string; lendingFeeRateBps: string; collateralAmount: string;
  haircut: string; startDate: string; tenor: string; recallDate: string; status: number;
};

export const lending = {
  initiate: (b: LendInitiate) =>
    dltTx<{ lendId: string }>(`/lending/initiate`, b),

  initiateWithHaircut: (b: LendInitiate & { haircut: number }) =>
    dltTx<{ lendId: string }>(`/lending/initiate-with-haircut`, b),

  return: (lendId: string) =>
    dltTx<{ ok: boolean }>(`/lending/return`, { lendId }),

  recall: (lendId: string) =>
    dltTx<{ ok: boolean }>(`/lending/recall`, { lendId }),

  default: (lendId: string) =>
    dltTx<{ ok: boolean }>(`/lending/default`, { lendId }),

  lastId: () =>
    dltGet<{ lendId: string }>(`/lending/last-id`),

  get: (lendId: string) =>
    dltGet<LendDetail>(`/lending/${lendId}`),
};
