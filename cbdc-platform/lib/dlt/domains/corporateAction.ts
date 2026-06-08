import { dltGet, dltTx } from "../client";

export const corporateAction = {
  scheduleCallOption: (b: { bondId: string; callDate: number; callPriceBps: number }) =>
    dltTx<{ ok: boolean }>(`/corporate-action/schedule-call-option`, b),

  executeCallBatch: (bondId: string) =>
    dltTx<{ ok: boolean }>(`/corporate-action/execute-call-batch`, { bondId }),

  executeCallBatchPaginated: (b: { bondId: string; startIndex: number; endIndex: number }) =>
    dltTx<{ ok: boolean }>(`/corporate-action/execute-call-batch-paginated`, b),

  registerPutOption: (b: { bondId: string; putDate: number; putPriceBps: number }) =>
    dltTx<{ ok: boolean }>(`/corporate-action/register-put-option`, b),

  exercisePutOption: (b: { bondId: string; amount: number }) =>
    dltTx<{ ok: boolean }>(`/corporate-action/exercise-put-option`, b),

  proposeRestructuring: (b: { bondId: string; newCouponRateBps: number; newMaturityExtDays: number }) =>
    dltTx<{ ok: boolean }>(`/corporate-action/propose-restructuring`, b),

  approveRestructuring: (proposalId: string) =>
    dltTx<{ ok: boolean }>(`/corporate-action/approve-restructuring`, { proposalId }),

  executeRestructuring: (proposalId: string) =>
    dltTx<{ ok: boolean }>(`/corporate-action/execute-restructuring`, { proposalId }),

  rejectRestructuring: (proposalId: string) =>
    dltTx<{ ok: boolean }>(`/corporate-action/reject-restructuring`, { proposalId }),

  scheduleTenderOffer: (b: { bondId: string; openDate: number; closeDate: number; tenderPriceBps: number }) =>
    dltTx<{ ok: boolean }>(`/corporate-action/schedule-tender-offer`, b),

  tenderBonds: (b: { bondId: string; amount: number }) =>
    dltTx<{ ok: boolean }>(`/corporate-action/tender-bonds`, b),

  closeTenderOffer: (bondId: string) =>
    dltTx<{ ok: boolean }>(`/corporate-action/close-tender-offer`, { bondId }),

  proposeConsent: (b: { bondId: string; description: string; votingDurationDays: number; quorumBps: number }) =>
    dltTx<{ ok: boolean }>(`/corporate-action/propose-consent`, b),

  voteConsent: (b: { proposalId: string; inFavor: boolean }) =>
    dltTx<{ ok: boolean }>(`/corporate-action/vote-consent`, b),

  finalizeConsent: (proposalId: string) =>
    dltTx<{ ok: boolean }>(`/corporate-action/finalize-consent`, { proposalId }),

  lastProposalId: () =>
    dltGet<{ proposalId: string }>(`/corporate-action/last-proposal-id`),
};
