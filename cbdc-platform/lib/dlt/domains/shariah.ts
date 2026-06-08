import { dltGet, dltTx } from "../client";

export const shariah = {
  approveSukuk: (b: { bondId: string; shariahBoard: string }) => dltTx<{ ok: boolean }>(`/compliance/shariah/approve-sukuk`, b),
  isApproved: (bondId: string) => dltGet<{ approved: boolean }>(`/compliance/shariah/is-approved?bondId=${bondId}`),
};
