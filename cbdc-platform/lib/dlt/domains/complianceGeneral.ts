import { dltGet, dltTx } from "../client";

export const complianceGeneral = {
  setEligible: (b: { participant: string; assetId: string; eligible: boolean }) =>
    dltTx<{ ok: boolean }>(`/compliance/participant/eligible`, b),

  setSuspended: (b: { participant: string; suspended: boolean; reason: string }) =>
    dltTx<{ ok: boolean }>(`/compliance/participant/suspended`, b),

  setRiskCategory: (b: { participant: string; riskCategory: string }) =>
    dltTx<{ ok: boolean }>(`/compliance/participant/risk-category`, b),

  reportSuspicious: (b: { entity: string; reason: string; data?: string }) =>
    dltTx<{ ok: boolean }>(`/compliance/report-suspicious`, { data: "0x", ...b }),

  eligible: (q: { participant: string; assetId: string }) =>
    dltGet<{ eligible: boolean }>(
      `/compliance/participant/eligible?participant=${q.participant}&assetId=${q.assetId}`
    ),

  checkTransfer: (q: { from: string; to: string; assetId: string }) =>
    dltGet<{ allowed: boolean; reason: string }>(
      `/compliance/check-transfer?from=${q.from}&to=${q.to}&assetId=${q.assetId}`
    ),

  status: (q: { entity: string; assetId: string }) =>
    dltGet<{ isEligible: boolean; isSuspended: boolean; lastReviewDate: string; riskCategory: string }>(
      `/compliance/status?entity=${q.entity}&assetId=${q.assetId}`
    ),
};
