import { FastifyInstance } from "fastify";
import { z } from "zod";
import { tx, call } from "../pente";
import { config } from "../config";

// ── Zod schemas ──────────────────────────────────────────────────────────────

// CustodyService
const RegisterCustodianBody = z.object({ custodian: z.string() });
const SetBeneficialOwnerBody = z.object({
  bondId:       z.string(),
  custodian:    z.string(),
  subAccountId: z.string(),
  owner:        z.string(),
});

// PledgeService
const CreatePledgeBody = z.object({
  bondId:     z.string(),
  pledgor:    z.string(),
  pledgee:    z.string(),
  amount:     z.number().positive(),
  expiryDate: z.number().positive(),
});
const PledgeIdBody = z.object({ pledgeId: z.string() });

// RepoService
const InitiateRepoBody = z.object({
  bondId:   z.string(),
  seller:   z.string(),
  buyer:    z.string(),
  amount:   z.number().positive(),
  repoRate: z.number().positive(),
  tenor:    z.number().positive(),
});
const InitiateRepoWithHaircutBody = InitiateRepoBody.extend({
  marketPrice:        z.number().positive(),
  haircut:            z.number().nonnegative(),
  marginCallThreshold:z.number().nonnegative(),
});
const RepoIdBody = z.object({ repoId: z.string() });
const InitiateMarginCallBody = z.object({ repoId: z.string(), currentMarketPrice: z.number().positive() });
const RespondToMarginCallBody = z.object({ repoId: z.string(), amount: z.number().positive() });

// SecuritiesLendingService
const InitiateLendBody = z.object({
  bondId:     z.string(),
  lender:     z.string(),
  borrower:   z.string(),
  amount:     z.number().positive(),
  feeRateBps: z.number().nonnegative(),
  tenor:      z.number().positive(),
});
const InitiateLendWithHaircutBody = InitiateLendBody.extend({ haircut: z.number().nonnegative() });
const LendIdBody = z.object({ lendId: z.string() });

// ── Plugin ───────────────────────────────────────────────────────────────────

export async function bondAdvancedRoute(app: FastifyInstance): Promise<void> {

  // ── CustodyService ──────────────────────────────────────────────────────

  app.post("/custody/register-custodian", async (req, reply) => {
    const parsed = RegisterCustodianBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.custodyService, "registerCustodian", parsed.data);
    return { ok: true };
  });

  app.post("/custody/beneficial-owner", async (req, reply) => {
    const parsed = SetBeneficialOwnerBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.custodyService, "setBeneficialOwner", parsed.data);
    return { ok: true };
  });

  app.get<{ Querystring: { bondId: string; custodian: string; subAccountId: string } }>(
    "/custody/beneficial-owner",
    async (req, reply) => {
      const { bondId, custodian, subAccountId } = req.query;
      if (!bondId || !custodian || !subAccountId)
        return reply.code(400).send({ error: "bondId, custodian, subAccountId required" });
      const res = await call(config.contracts.custodyService, "getBeneficialOwner", {
        bondId, custodian, subAccountId,
      });
      return { owner: String(res["0"]) };
    }
  );

  app.get<{ Querystring: { custodian: string; bondId: string } }>(
    "/custody/holdings",
    async (req, reply) => {
      const { custodian, bondId } = req.query;
      if (!custodian || !bondId)
        return reply.code(400).send({ error: "custodian, bondId required" });
      const res = await call(config.contracts.custodyService, "getCustodianHoldings", {
        custodian, bondId,
      });
      return { custodian, bondId, holdings: String(res["0"]) };
    }
  );

  // ── PledgeService ───────────────────────────────────────────────────────

  app.post("/pledge/create", async (req, reply) => {
    const parsed = CreatePledgeBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.pledgeService, "createPledge", parsed.data);
    const res = await call(config.contracts.pledgeService, "getLastPledgeId");
    return { pledgeId: String(res["0"]) };
  });

  app.post("/pledge/create-v2", async (req, reply) => {
    const parsed = CreatePledgeBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.pledgeService, "createPledgeV2", parsed.data);
    return { ok: true };
  });

  app.post("/pledge/release", async (req, reply) => {
    const parsed = PledgeIdBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.pledgeService, "releasePledge", parsed.data);
    return { ok: true };
  });

  app.post("/pledge/enforce", async (req, reply) => {
    const parsed = PledgeIdBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.pledgeService, "enforcePledge", parsed.data);
    return { ok: true };
  });

  app.get("/pledge/last-id", async () => {
    const res = await call(config.contracts.pledgeService, "getLastPledgeId");
    return { pledgeId: String(res["0"]) };
  });

  app.get<{ Params: { pledgeId: string } }>("/pledge/:pledgeId", async (req) => {
    const res = await call(config.contracts.pledgeService, "getPledge", {
      pledgeId: req.params.pledgeId,
    });
    const t = res["0"] as Record<string, unknown>;
    return {
      pledgeId: req.params.pledgeId,
      bondId:     String(t.bondId),
      pledgor:    String(t.pledgor),
      pledgee:    String(t.pledgee),
      amount:     String(t.amount),
      expiryDate: String(t.expiryDate),
      status:     Number(t.status),
    };
  });

  // ── RepoService ─────────────────────────────────────────────────────────

  app.post("/repo/initiate", async (req, reply) => {
    const parsed = InitiateRepoBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.repoService, "initiateRepo", parsed.data);
    const res = await call(config.contracts.repoService, "getLastRepoId");
    return { repoId: String(res["0"]) };
  });

  app.post("/repo/initiate-with-haircut", async (req, reply) => {
    const parsed = InitiateRepoWithHaircutBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.repoService, "initiateRepoWithHaircut", parsed.data);
    const res = await call(config.contracts.repoService, "getLastRepoId");
    return { repoId: String(res["0"]) };
  });

  app.post("/repo/initiate-v2", async (req, reply) => {
    const parsed = InitiateRepoBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.repoService, "initiateRepoV2", parsed.data);
    return { ok: true };
  });

  app.post("/repo/consent-early-termination", async (req, reply) => {
    const parsed = RepoIdBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.repoService, "consentEarlyTermination", parsed.data);
    return { ok: true };
  });

  app.post("/repo/terminate-early", async (req, reply) => {
    const parsed = RepoIdBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.repoService, "terminateRepoEarly", parsed.data);
    return { ok: true };
  });

  app.post("/repo/unwind", async (req, reply) => {
    const parsed = RepoIdBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.repoService, "unwindRepo", parsed.data);
    return { ok: true };
  });

  app.post("/repo/margin-call", async (req, reply) => {
    const parsed = InitiateMarginCallBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.repoService, "initiateMarginCall", parsed.data);
    return { ok: true };
  });

  app.post("/repo/margin-call/respond", async (req, reply) => {
    const parsed = RespondToMarginCallBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.repoService, "respondToMarginCall", parsed.data);
    return { ok: true };
  });

  app.get("/repo/last-id", async () => {
    const res = await call(config.contracts.repoService, "getLastRepoId");
    return { repoId: String(res["0"]) };
  });

  app.get<{ Params: { repoId: string } }>("/repo/:repoId", async (req) => {
    const res = await call(config.contracts.repoService, "getRepo", {
      repoId: req.params.repoId,
    });
    const r = res["0"] as Record<string, unknown>;
    return {
      repoId: req.params.repoId,
      bondId:                     String(r.bondId),
      seller:                     String(r.seller),
      buyer:                      String(r.buyer),
      amount:                     String(r.amount),
      repoRate:                   String(r.repoRate),
      haircut:                    String(r.haircut),
      purchasePrice:              String(r.purchasePrice),
      repurchasePrice:            String(r.repurchasePrice),
      tenor:                      String(r.tenor),
      startDate:                  String(r.startDate),
      endDate:                    String(r.endDate),
      status:                     Number(r.status),
      sellerConsentEarlyTermination: Boolean(r.sellerConsentEarlyTermination),
      buyerConsentEarlyTermination:  Boolean(r.buyerConsentEarlyTermination),
      initialMarketPrice:         String(r.initialMarketPrice),
      marginCallThreshold:        String(r.marginCallThreshold),
      marginCallActive:           Boolean(r.marginCallActive),
      marginCallDeadline:         String(r.marginCallDeadline),
    };
  });

  // ── SecuritiesLendingService ────────────────────────────────────────────

  app.post("/lending/initiate", async (req, reply) => {
    const parsed = InitiateLendBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.securitiesLending, "initiateLend", parsed.data);
    const res = await call(config.contracts.securitiesLending, "getLastLendId");
    return { lendId: String(res["0"]) };
  });

  app.post("/lending/initiate-with-haircut", async (req, reply) => {
    const parsed = InitiateLendWithHaircutBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.securitiesLending, "initiateLendWithHaircut", parsed.data);
    const res = await call(config.contracts.securitiesLending, "getLastLendId");
    return { lendId: String(res["0"]) };
  });

  app.post("/lending/initiate-v2", async (req, reply) => {
    const parsed = InitiateLendBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.securitiesLending, "initiateLendV2", parsed.data);
    return { ok: true };
  });

  app.post("/lending/return", async (req, reply) => {
    const parsed = LendIdBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.securitiesLending, "returnSecurities", parsed.data);
    return { ok: true };
  });

  app.post("/lending/recall", async (req, reply) => {
    const parsed = LendIdBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.securitiesLending, "recallLoan", parsed.data);
    return { ok: true };
  });

  app.post("/lending/default", async (req, reply) => {
    const parsed = LendIdBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.securitiesLending, "defaultOnLoan", parsed.data);
    return { ok: true };
  });

  app.get("/lending/last-id", async () => {
    const res = await call(config.contracts.securitiesLending, "getLastLendId");
    return { lendId: String(res["0"]) };
  });

  app.get<{ Params: { lendId: string } }>("/lending/:lendId", async (req) => {
    const res = await call(config.contracts.securitiesLending, "getLend", {
      lendId: req.params.lendId,
    });
    const l = res["0"] as Record<string, unknown>;
    return {
      lendId: req.params.lendId,
      bondId:            String(l.bondId),
      lender:            String(l.lender),
      borrower:          String(l.borrower),
      amount:            String(l.amount),
      lendingFeeRateBps: String(l.lendingFeeRateBps),
      collateralAmount:  String(l.collateralAmount),
      haircut:           String(l.haircut),
      startDate:         String(l.startDate),
      tenor:             String(l.tenor),
      recallDate:        String(l.recallDate),
      status:            Number(l.status),
    };
  });
}
