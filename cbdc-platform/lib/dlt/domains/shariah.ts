import { dltGet, dltTx } from "../client";

export const shariah = {
  approveSukuk: (b: { bondId: string; shariahBoard: string }) =>
    dltTx<{ ok: boolean }>(`/compliance/shariah/approve-sukuk`, b),

  certifyProfit: (b: { bondId: string; totalProfit: number; investorShare: number }) =>
    dltTx<{ compliant: boolean }>(`/compliance/shariah/certify-profit`, b),

  reportEvent: (b: { bondId: string; eventType: string }) =>
    dltTx<{ ok: boolean }>(`/compliance/shariah/event`, b),

  approval: (bondId: string) =>
    dltGet<{ approved: boolean; board: string }>(
      `/compliance/shariah/approval?bondId=${bondId}`
    ),

  profitDistribution: (bondId: string) =>
    dltGet<{ totalProfit: string; investorShare: string; certified: boolean; certificationTimestamp: string }>(
      `/compliance/shariah/profit-distribution?bondId=${bondId}`
    ),

  events: (bondId: string) =>
    dltGet<{ events: { eventType: string; timestamp: string; description: string }[] }>(
      `/compliance/shariah/events?bondId=${bondId}`
    ),

  isApproved: (bondId: string) =>
    dltGet<{ approved: boolean }>(`/compliance/shariah/is-approved?bondId=${bondId}`),
};
