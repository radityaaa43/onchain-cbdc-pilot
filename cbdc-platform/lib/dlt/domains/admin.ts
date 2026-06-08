import { dltGet, dltTx } from "../client";

export const adminChain = {
  grantRole: (b: { contract: string; role: string; account: string }) => dltTx<{ ok: boolean }>(`/admin/grant-role`, b),
  revokeRole: (b: { contract: string; role: string; account: string }) => dltTx<{ ok: boolean }>(`/admin/revoke-role`, b),
  hasRole: (q: { contract: string; role: string; account: string }) =>
    dltGet<{ hasRole: boolean }>(`/admin/has-role?contract=${q.contract}&role=${q.role}&account=${q.account}`),
};
