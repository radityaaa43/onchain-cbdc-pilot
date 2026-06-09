import { dltGet, dltTx } from "../client";

export const oracle = {
  setRate: (b: { bondId: string; rate: number }) =>
    dltTx<{ ok: boolean }>(`/oracle/rate`, b),

  setPrice: (b: { bondId: string; price: number }) =>
    dltTx<{ ok: boolean }>(`/oracle/price`, b),

  creditEvent: (b: { bondId: string; eventType: string; timestamp: number }) =>
    dltTx<{ ok: boolean }>(`/oracle/credit-event`, b),

  getRate: (bondId: string) =>
    dltGet<{ bondId: string; rate: string }>(`/oracle/rate/${bondId}`),

  getPrice: (bondId: string) =>
    dltGet<{ bondId: string; price: string }>(`/oracle/price/${bondId}`),

  getCreditEvent: (bondId: string, eventType: string) =>
    dltGet<{ bondId: string; eventType: string; timestamp: string }>(
      `/oracle/credit-event/${bondId}/${eventType}`
    ),
};
