import { dltGet, dltTx } from "../client";

export const coupon = {
  setRate: (b: { bondId: string; rateBps: number }) => dltTx<{ ok: boolean }>(`/coupon/set-rate`, b),
  setDayCount: (b: { bondId: string; convention: number }) => dltTx<{ ok: boolean }>(`/coupon/set-day-count`, b),
  pay: (b: { bondId: string; recipient: string }) => dltTx<{ ok: boolean }>(`/coupon/pay`, b),
  payBatch: (b: { bondId: string }) => dltTx<{ ok: boolean }>(`/coupon/pay-batch`, b),
  calculate: (bondId: string) => dltGet<{ bondId: string; couponAmount: string }>(`/coupon/calculate/${bondId}`),
  count: (bondId: string) => dltGet<{ bondId: string; count: string }>(`/coupon/count/${bondId}`),
};
