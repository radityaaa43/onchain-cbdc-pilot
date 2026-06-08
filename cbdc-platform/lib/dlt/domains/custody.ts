import { dltGet, dltTx } from "../client";

export const custody = {
  registerCustodian: (custodian: string) =>
    dltTx<{ ok: boolean }>(`/custody/register-custodian`, { custodian }),

  setBeneficialOwner: (b: { bondId: string; custodian: string; subAccountId: string; owner: string }) =>
    dltTx<{ ok: boolean }>(`/custody/beneficial-owner`, b),

  getBeneficialOwner: (b: { bondId: string; custodian: string; subAccountId: string }) =>
    dltGet<{ owner: string }>(
      `/custody/beneficial-owner?bondId=${b.bondId}&custodian=${b.custodian}&subAccountId=${b.subAccountId}`
    ),

  getHoldings: (b: { custodian: string; bondId: string }) =>
    dltGet<{ custodian: string; bondId: string; holdings: string }>(
      `/custody/holdings?custodian=${b.custodian}&bondId=${b.bondId}`
    ),
};
