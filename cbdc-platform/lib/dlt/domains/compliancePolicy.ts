import { dltTx } from "../client";

export const compliancePolicy = {
  checkTransfer: (b: { from: string; to: string; amount: number; assetId: string }) =>
    dltTx<{ allowed: boolean; reason: string }>(`/compliance/policy/check-transfer`, b),

  addRule: (b: { ruleId: string; ruleContract: string }) =>
    dltTx<{ ok: boolean }>(`/compliance/policy/rule`, b),

  removeRule: (ruleId: string) =>
    dltTx<{ ok: boolean }>(`/compliance/policy/rule/${ruleId}`, {}),

  setDefault: (policyAddress: string) =>
    dltTx<{ ok: boolean }>(`/compliance/policy/default`, { policyAddress }),
};
