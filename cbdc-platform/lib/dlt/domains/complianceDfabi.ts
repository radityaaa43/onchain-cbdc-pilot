import { dltGet, dltTx } from "../client";

export const complianceDfabi = {
  setEligible: (b: { participant: string; eligible: boolean }) =>
    dltTx<{ ok: boolean }>(`/compliance/dfabi/eligible`, b),

  setEligibleByBond: (b: { participant: string; bondId: string; eligible: boolean }) =>
    dltTx<{ ok: boolean }>(`/compliance/dfabi/eligible-by-bond`, b),

  setRestriction: (b: { bondId: string; restriction: { minAmount: number; maxAmount: number } }) =>
    dltTx<{ ok: boolean }>(`/compliance/dfabi/restriction`, b),

  checkTransfer: (q: { bondId: string; from: string; to: string; amount: number }) =>
    dltGet<{ allowed: boolean; reason: string }>(
      `/compliance/dfabi/check-transfer?bondId=${q.bondId}&from=${q.from}&to=${q.to}&amount=${q.amount}`
    ),

  eligibility: (q: { participant: string; bondId: string }) =>
    dltGet<{ eligible: boolean }>(
      `/compliance/dfabi/eligibility?participant=${q.participant}&bondId=${q.bondId}`
    ),
};
