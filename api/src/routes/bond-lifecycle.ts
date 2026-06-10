import { FastifyInstance } from "fastify";
import { z } from "zod";
import { tx, call } from "../pente";
import { config } from "../config";

// ── Shared schemas ────────────────────────────────────────────────────────────
const BondId   = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "bondId must be bytes32 hex");
const Address  = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be an Ethereum address");
const Uint256  = z.number().nonnegative().int();
const Bytes32  = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be bytes32 hex");

// ── CouponService schemas ─────────────────────────────────────────────────────
const SetCouponRateBody            = z.object({ bondId: BondId, rateBps: Uint256 });
const SetDayCountBody              = z.object({ bondId: BondId, convention: Uint256 });
const SetMetadataRegistryBody      = z.object({ bondId: BondId, registry: Address });
const PayCouponBody                = z.object({ bondId: BondId, recipient: Address });
const PayCouponBatchBody           = z.object({ bondId: BondId });

// ── MaturityService schemas ───────────────────────────────────────────────────
const SetRedemptionServiceBody     = z.object({ redemptionService: Address });
const SetMaturityInfoBody          = z.object({
  bondId: BondId,
  maturityDate: Uint256,
  finalRedemptionPct: Uint256,
  principalAmount: Uint256,
});
const TriggerMaturityBody          = z.object({ bondId: BondId });

// ── MaturityOracle schemas ────────────────────────────────────────────────────
const TrackBondBody                = z.object({ bondId: BondId });
const UntrackBondBody              = z.object({ bondId: BondId });

// ── RedemptionService schemas ─────────────────────────────────────────────────
const RedeemBody                   = z.object({ bondId: BondId, holder: Address, amount: Uint256 });

// ── TransferService schemas ───────────────────────────────────────────────────
const TransferBody                 = z.object({
  bondId: BondId,
  from: Address,
  to: Address,
  amount: Uint256,
  data: z.string().default("0x"),
});
const BatchTransferBody            = z.object({
  bondId: BondId,
  froms: z.array(Address).min(1),
  tos: z.array(Address).min(1),
  amounts: z.array(Uint256).min(1),
});

// ── CorporateActionService schemas ────────────────────────────────────────────
const SetCouponServiceBody         = z.object({ couponService: Address });
const ScheduleCallOptionBody       = z.object({ bondId: BondId, callDate: Uint256, callPriceBps: Uint256 });
const ExecuteCallBatchBody         = z.object({ bondId: BondId });
const ExecuteCallBatchPaginatedBody = z.object({ bondId: BondId, startIndex: Uint256, endIndex: Uint256 });
const RegisterPutOptionBody        = z.object({ bondId: BondId, putDate: Uint256, putPriceBps: Uint256 });
const ExercisePutOptionBody        = z.object({ bondId: BondId, amount: Uint256 });
const ProposeRestructuringBody     = z.object({ bondId: BondId, newCouponRateBps: Uint256, newMaturityExtDays: Uint256 });
const RestructuringProposalBody    = z.object({ proposalId: Bytes32 });
const ScheduleTenderOfferBody      = z.object({ bondId: BondId, openDate: Uint256, closeDate: Uint256, tenderPriceBps: Uint256 });
const TenderBondsBody              = z.object({ bondId: BondId, amount: Uint256 });
const CloseTenderOfferBody         = z.object({ bondId: BondId });
const ProposeConsentBody           = z.object({ bondId: BondId, description: z.string(), votingDurationDays: Uint256, quorumBps: Uint256 });
const ProposeConsentV2Body         = z.object({ bondId: BondId, votingDurationDays: Uint256, quorumBps: Uint256 });
const VoteConsentBody              = z.object({ proposalId: Bytes32, inFavor: z.boolean() });
const FinalizeConsentBody          = z.object({ proposalId: Bytes32 });

export async function bondLifecycleRoute(app: FastifyInstance): Promise<void> {
  // ── CouponService ───────────────────────────────────────────────────────────

  app.post("/coupon/set-rate", async (req, reply) => {
    const p = SetCouponRateBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.couponService, "setCouponRate", { bondId: p.data.bondId, rateBps: p.data.rateBps });
    return { ok: true };
  });

  app.post("/coupon/set-day-count", async (req, reply) => {
    const p = SetDayCountBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.couponService, "setBondDayCountConvention", { bondId: p.data.bondId, convention: p.data.convention });
    return { ok: true };
  });

  app.post("/coupon/set-metadata-registry", async (req, reply) => {
    const p = SetMetadataRegistryBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.couponService, "setMetadataRegistry", { bondId: p.data.bondId, registry: p.data.registry });
    return { ok: true };
  });

  app.get<{ Params: { bondId: string } }>("/coupon/calculate/:bondId", async (req, reply) => {
    const parsed = BondId.safeParse(req.params.bondId);
    if (!parsed.success) return reply.code(400).send({ error: "invalid bondId" });
    const res = await call(config.contracts.couponService, "calculateCoupon", { bondId: parsed.data });
    return { bondId: parsed.data, couponAmount: String(res["0"]) };
  });

  app.post("/coupon/pay", async (req, reply) => {
    const p = PayCouponBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.couponService, "payCoupon", { bondId: p.data.bondId, recipient: p.data.recipient });
    return { ok: true };
  });

  app.post("/coupon/pay-batch", async (req, reply) => {
    const p = PayCouponBatchBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.couponService, "payCouponBatch", { bondId: p.data.bondId });
    return { ok: true };
  });

  app.get<{ Params: { bondId: string; couponId: string } }>("/coupon/status/:bondId/:couponId", async (req, reply) => {
    const bondIdParsed = BondId.safeParse(req.params.bondId);
    const couponIdParsed = z.coerce.number().nonnegative().safeParse(req.params.couponId);
    if (!bondIdParsed.success) return reply.code(400).send({ error: "invalid bondId" });
    if (!couponIdParsed.success) return reply.code(400).send({ error: "invalid couponId" });
    const res = await call(config.contracts.couponService, "getCouponStatus", {
      bondId: bondIdParsed.data,
      couponId: couponIdParsed.data,
    });
    const s = res["0"] as any;
    return {
      couponId: String(s?.couponId ?? s?.[0]),
      bondId: s?.bondId ?? s?.[1],
      amount: String(s?.amount ?? s?.[2]),
      paymentDate: String(s?.paymentDate ?? s?.[3]),
      isPaid: Boolean(s?.isPaid ?? s?.[4]),
    };
  });

  app.get<{ Params: { bondId: string } }>("/coupon/count/:bondId", async (req, reply) => {
    const parsed = BondId.safeParse(req.params.bondId);
    if (!parsed.success) return reply.code(400).send({ error: "invalid bondId" });
    const res = await call(config.contracts.couponService, "getCouponCount", { bondId: parsed.data });
    return { bondId: parsed.data, count: String(res["0"]) };
  });

  // ── MaturityService ─────────────────────────────────────────────────────────

  app.post("/maturity/set-redemption-service", async (req, reply) => {
    const p = SetRedemptionServiceBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.maturityService, "setRedemptionService", { redemptionService_: p.data.redemptionService });
    return { ok: true };
  });

  app.post("/maturity/set-info", async (req, reply) => {
    const p = SetMaturityInfoBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.maturityService, "setMaturityInfo", {
      bondId: p.data.bondId,
      maturityDate: p.data.maturityDate,
      finalRedemptionPct: p.data.finalRedemptionPct,
      principalAmount: p.data.principalAmount,
    });
    return { ok: true };
  });

  app.post("/maturity/trigger", async (req, reply) => {
    const p = TriggerMaturityBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.maturityService, "triggerMaturity", { bondId: p.data.bondId });
    return { ok: true };
  });

  app.get<{ Params: { bondId: string } }>("/maturity/info/:bondId", async (req, reply) => {
    const parsed = BondId.safeParse(req.params.bondId);
    if (!parsed.success) return reply.code(400).send({ error: "invalid bondId" });
    const res = await call(config.contracts.maturityService, "getMaturityInfo", { bondId: parsed.data });
    const s = res["0"] as any;
    return {
      bondId: s?.bondId ?? s?.[0],
      maturityDate: String(s?.maturityDate ?? s?.[1]),
      finalRedemptionPct: String(s?.finalRedemptionPct ?? s?.[2]),
      principalAmount: String(s?.principalAmount ?? s?.[3]),
      isTriggered: Boolean(s?.isTriggered ?? s?.[4]),
    };
  });

  app.get<{ Params: { bondId: string } }>("/maturity/is-matured/:bondId", async (req, reply) => {
    const parsed = BondId.safeParse(req.params.bondId);
    if (!parsed.success) return reply.code(400).send({ error: "invalid bondId" });
    const res = await call(config.contracts.maturityService, "isMatured", { bondId: parsed.data });
    return { bondId: parsed.data, matured: Boolean(res["0"]) };
  });

  app.get("/maturity/matured-count", async () => {
    const res = await call(config.contracts.maturityService, "getMaturedBondsCount");
    return { count: String(res["0"]) };
  });

  // ── MaturityOracle ──────────────────────────────────────────────────────────

  app.post("/maturity-oracle/track", async (req, reply) => {
    const p = TrackBondBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.maturityOracle, "trackBond", { bondId: p.data.bondId });
    return { ok: true };
  });

  app.post("/maturity-oracle/untrack", async (req, reply) => {
    const p = UntrackBondBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.maturityOracle, "untrackBond", { bondId: p.data.bondId });
    return { ok: true };
  });

  app.post("/maturity-oracle/trigger-batch", async (_req, reply) => {
    await tx(config.contracts.maturityOracle, "triggerMaturityBatch", {});
    return { ok: true };
  });

  app.get("/maturity-oracle/tracked-bonds", async () => {
    const res = await call(config.contracts.maturityOracle, "getTrackedBonds");
    return { bonds: res["0"] };
  });

  // ── RedemptionService ───────────────────────────────────────────────────────

  app.post("/bond-redemption/redeem", async (req, reply) => {
    const p = RedeemBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.bondRedemption, "redeemBond", {
      bondId: p.data.bondId,
      holder: p.data.holder,
      amount: p.data.amount,
    });
    return { ok: true };
  });

  app.get<{ Params: { bondId: string } }>("/bond-redemption/redeemed-total/:bondId", async (req, reply) => {
    const parsed = BondId.safeParse(req.params.bondId);
    if (!parsed.success) return reply.code(400).send({ error: "invalid bondId" });
    const res = await call(config.contracts.bondRedemption, "getRedeemedTotal", { bondId: parsed.data });
    return { bondId: parsed.data, redeemedTotal: String(res["0"]) };
  });

  app.get<{ Params: { bondId: string } }>("/bond-redemption/total/:bondId", async (req, reply) => {
    const parsed = BondId.safeParse(req.params.bondId);
    if (!parsed.success) return reply.code(400).send({ error: "invalid bondId" });
    const res = await call(config.contracts.bondRedemption, "getRedemptionTotal", { bondId: parsed.data });
    return { bondId: parsed.data, redemptionTotal: String(res["0"]) };
  });

  app.get<{ Params: { bondId: string } }>("/bond-redemption/funding/:bondId", async (req, reply) => {
    const parsed = BondId.safeParse(req.params.bondId);
    if (!parsed.success) return reply.code(400).send({ error: "invalid bondId" });
    const res = await call(config.contracts.bondRedemption, "hasSufficientFunding", { bondId: parsed.data });
    return {
      bondId: parsed.data,
      sufficient: Boolean(res["sufficient"] ?? res["0"]),
      required: String(res["required"] ?? res["1"]),
      available: String(res["available"] ?? res["2"]),
    };
  });

  // ── TransferService ─────────────────────────────────────────────────────────

  app.post("/bond-transfer/transfer", async (req, reply) => {
    const p = TransferBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.transferService, "transfer", {
      bondId: p.data.bondId,
      from: p.data.from,
      to: p.data.to,
      amount: p.data.amount,
      data: p.data.data,
    });
    return { ok: true };
  });

  app.post("/bond-transfer/batch", async (req, reply) => {
    const p = BatchTransferBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.transferService, "batchTransfer", {
      bondId: p.data.bondId,
      froms: p.data.froms,
      tos: p.data.tos,
      amounts: p.data.amounts,
    });
    return { ok: true };
  });

  // ── CorporateActionService ──────────────────────────────────────────────────

  app.post("/corporate-action/set-coupon-service", async (req, reply) => {
    const p = SetCouponServiceBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.corporateAction, "setCouponService", { _couponService: p.data.couponService });
    return { ok: true };
  });

  app.post("/corporate-action/schedule-call-option", async (req, reply) => {
    const p = ScheduleCallOptionBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.corporateAction, "scheduleCallOption", {
      bondId: p.data.bondId,
      callDate: p.data.callDate,
      callPriceBps: p.data.callPriceBps,
    });
    return { ok: true };
  });

  app.post("/corporate-action/execute-call-batch", async (req, reply) => {
    const p = ExecuteCallBatchBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.corporateAction, "executeCallBatch", { bondId: p.data.bondId });
    return { ok: true };
  });

  app.post("/corporate-action/execute-call-batch-paginated", async (req, reply) => {
    const p = ExecuteCallBatchPaginatedBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.corporateAction, "executeCallBatchPaginated", {
      bondId: p.data.bondId,
      startIndex: p.data.startIndex,
      endIndex: p.data.endIndex,
    });
    return { ok: true };
  });

  app.post("/corporate-action/register-put-option", async (req, reply) => {
    const p = RegisterPutOptionBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.corporateAction, "registerPutOption", {
      bondId: p.data.bondId,
      putDate: p.data.putDate,
      putPriceBps: p.data.putPriceBps,
    });
    return { ok: true };
  });

  app.post("/corporate-action/exercise-put-option", async (req, reply) => {
    const p = ExercisePutOptionBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.corporateAction, "exercisePutOption", {
      bondId: p.data.bondId,
      amount: p.data.amount,
    });
    return { ok: true };
  });

  app.post("/corporate-action/propose-restructuring", async (req, reply) => {
    const p = ProposeRestructuringBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.corporateAction, "proposeRestructuring", {
      bondId: p.data.bondId,
      newCouponRateBps: p.data.newCouponRateBps,
      newMaturityExtDays: p.data.newMaturityExtDays,
    });
    return { ok: true };
  });

  app.post("/corporate-action/propose-restructuring-v2", async (req, reply) => {
    const p = ProposeRestructuringBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.corporateAction, "proposeRestructuringV2", {
      bondId: p.data.bondId,
      newCouponRateBps: p.data.newCouponRateBps,
      newMaturityExtDays: p.data.newMaturityExtDays,
    });
    return { ok: true };
  });

  app.post("/corporate-action/approve-restructuring", async (req, reply) => {
    const p = RestructuringProposalBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.corporateAction, "approveRestructuring", { proposalId: p.data.proposalId });
    return { ok: true };
  });

  app.post("/corporate-action/execute-restructuring", async (req, reply) => {
    const p = RestructuringProposalBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.corporateAction, "executeRestructuring", { proposalId: p.data.proposalId });
    return { ok: true };
  });

  app.post("/corporate-action/reject-restructuring", async (req, reply) => {
    const p = RestructuringProposalBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.corporateAction, "rejectRestructuring", { proposalId: p.data.proposalId });
    return { ok: true };
  });

  app.post("/corporate-action/schedule-tender-offer", async (req, reply) => {
    const p = ScheduleTenderOfferBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.corporateAction, "scheduleTenderOffer", {
      bondId: p.data.bondId,
      openDate: p.data.openDate,
      closeDate: p.data.closeDate,
      tenderPriceBps: p.data.tenderPriceBps,
    });
    return { ok: true };
  });

  app.post("/corporate-action/tender-bonds", async (req, reply) => {
    const p = TenderBondsBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.corporateAction, "tenderBonds", { bondId: p.data.bondId, amount: p.data.amount });
    return { ok: true };
  });

  app.post("/corporate-action/close-tender-offer", async (req, reply) => {
    const p = CloseTenderOfferBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.corporateAction, "closeTenderOffer", { bondId: p.data.bondId });
    return { ok: true };
  });

  app.post("/corporate-action/propose-consent", async (req, reply) => {
    const p = ProposeConsentBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.corporateAction, "proposeConsent", {
      bondId: p.data.bondId,
      description: p.data.description,
      votingDurationDays: p.data.votingDurationDays,
      quorumBps: p.data.quorumBps,
    });
    return { ok: true };
  });

  app.post("/corporate-action/propose-consent-v2", async (req, reply) => {
    const p = ProposeConsentV2Body.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.corporateAction, "proposeConsentV2", {
      bondId: p.data.bondId,
      votingDurationDays: p.data.votingDurationDays,
      quorumBps: p.data.quorumBps,
    });
    return { ok: true };
  });

  app.get("/corporate-action/last-proposal-id", async () => {
    const res = await call(config.contracts.corporateAction, "getLastProposalId");
    return { proposalId: String(res["0"]) };
  });

  app.post("/corporate-action/vote-consent", async (req, reply) => {
    const p = VoteConsentBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.corporateAction, "voteConsent", {
      proposalId: p.data.proposalId,
      inFavor: p.data.inFavor,
    });
    return { ok: true };
  });

  app.post("/corporate-action/finalize-consent", async (req, reply) => {
    const p = FinalizeConsentBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    await tx(config.contracts.corporateAction, "finalizeConsent", { proposalId: p.data.proposalId });
    return { ok: true };
  });
}
