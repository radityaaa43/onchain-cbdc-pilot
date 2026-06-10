import { FastifyInstance } from "fastify";
import { z } from "zod";
import { tx, call } from "../pente";
import { config } from "../config";

// ── Zod schemas ──────────────────────────────────────────────────────────────

// DFABIComplianceService
const SetEligibleBody        = z.object({ participant: z.string(), eligible: z.boolean() });
const SetEligibleByBondBody  = z.object({ participant: z.string(), bondId: z.string(), eligible: z.boolean() });
const SetRestrictionBody     = z.object({ bondId: z.string(), restriction: z.object({ minAmount: z.number(), maxAmount: z.number() }) });

// ComplianceService
const SetEligibleParticipantBody  = z.object({ participant: z.string(), assetId: z.string(), eligible: z.boolean() });
const ReportSuspiciousBody        = z.object({ entity: z.string(), reason: z.string(), data: z.string().optional().default("0x") });
const SetParticipantSuspendedBody = z.object({ participant: z.string(), suspended: z.boolean(), reason: z.string() });
const SetRiskCategoryBody         = z.object({ participant: z.string(), riskCategory: z.string() });

// PolicyEngineService
const AddPolicyRuleBody    = z.object({ ruleId: z.string(), ruleContract: z.string() });
const RemovePolicyRuleBody = z.object({ ruleId: z.string() });
const SetDefaultPolicyBody = z.object({ policyAddress: z.string() });
const CheckTransferPEBody  = z.object({ from: z.string(), to: z.string(), amount: z.number().positive(), assetId: z.string() });

// ShariahComplianceService
const ApproveSukukBody              = z.object({ bondId: z.string(), shariahBoard: z.string() });
const CertifyProfitBody             = z.object({ bondId: z.string(), totalProfit: z.number(), investorShare: z.number() });
const ReportShariahEventBody        = z.object({ bondId: z.string(), eventType: z.string() });

// ── Plugin ───────────────────────────────────────────────────────────────────

export async function complianceRoute(app: FastifyInstance): Promise<void> {

  // ── DFABIComplianceService ─────────────────────────────────────────────────

  app.post("/compliance/dfabi/eligible", async (req, reply) => {
    const parsed = SetEligibleBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.dfabiCompliance, "setEligible", parsed.data);
    return { ok: true };
  });

  app.post("/compliance/dfabi/eligible-by-bond", async (req, reply) => {
    const parsed = SetEligibleByBondBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.dfabiCompliance, "setEligibleByBond", parsed.data);
    return { ok: true };
  });

  app.post("/compliance/dfabi/restriction", async (req, reply) => {
    const parsed = SetRestrictionBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.dfabiCompliance, "setRestriction", parsed.data);
    return { ok: true };
  });

  app.get<{ Querystring: { bondId: string; from: string; to: string; amount: string } }>(
    "/compliance/dfabi/check-transfer",
    async (req, reply) => {
      const { bondId, from, to, amount } = req.query;
      if (!bondId || !from || !to || !amount) return reply.code(400).send({ error: "bondId, from, to, amount required" });
      const res = await call(config.contracts.dfabiCompliance, "checkTransfer", { bondId, from, to, amount: Number(amount) });
      return { allowed: Boolean(res["0"]), reason: String(res["1"] ?? "") };
    }
  );

  app.get<{ Querystring: { participant: string; bondId: string } }>(
    "/compliance/dfabi/eligibility",
    async (req, reply) => {
      const { participant, bondId } = req.query;
      if (!participant || !bondId) return reply.code(400).send({ error: "participant and bondId required" });
      const res = await call(config.contracts.dfabiCompliance, "checkEligibility", { participant, bondId });
      return { eligible: Boolean(res["0"]) };
    }
  );

  // ── ComplianceService ──────────────────────────────────────────────────────

  app.post("/compliance/participant/eligible", async (req, reply) => {
    const parsed = SetEligibleParticipantBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.complianceService, "setEligibleParticipant", parsed.data);
    return { ok: true };
  });

  app.post("/compliance/participant/suspended", async (req, reply) => {
    const parsed = SetParticipantSuspendedBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.complianceService, "setParticipantSuspended", parsed.data);
    return { ok: true };
  });

  app.post("/compliance/participant/risk-category", async (req, reply) => {
    const parsed = SetRiskCategoryBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.complianceService, "setRiskCategory", parsed.data);
    return { ok: true };
  });

  app.post("/compliance/report-suspicious", async (req, reply) => {
    const parsed = ReportSuspiciousBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.complianceService, "reportSuspiciousActivity", parsed.data);
    return { ok: true };
  });

  app.get<{ Querystring: { participant: string; assetId: string } }>(
    "/compliance/participant/eligible",
    async (req, reply) => {
      const { participant, assetId } = req.query;
      if (!participant || !assetId) return reply.code(400).send({ error: "participant and assetId required" });
      const res = await call(config.contracts.complianceService, "isEligible", { participant, assetId });
      return { eligible: Boolean(res["0"]) };
    }
  );

  app.get<{ Querystring: { from: string; to: string; assetId: string } }>(
    "/compliance/check-transfer",
    async (req, reply) => {
      const { from, to, assetId } = req.query;
      if (!from || !to || !assetId) return reply.code(400).send({ error: "from, to, assetId required" });
      const res = await call(config.contracts.complianceService, "checkTransferAllowed", { from, to, amount: 0, assetId });
      return { allowed: Boolean(res["0"]), reason: String(res["1"] ?? "") };
    }
  );

  app.get<{ Querystring: { entity: string; assetId: string } }>(
    "/compliance/status",
    async (req, reply) => {
      const { entity, assetId } = req.query;
      if (!entity || !assetId) return reply.code(400).send({ error: "entity and assetId required" });
      const res = await call(config.contracts.complianceService, "getComplianceStatus", { entity, assetId });
      const s = res["0"] as Record<string, unknown>;
      return {
        isEligible:     Boolean(s?.isEligible),
        isSuspended:    Boolean(s?.isSuspended),
        lastReviewDate: String(s?.lastReviewDate ?? "0"),
        riskCategory:   String(s?.riskCategory ?? ""),
      };
    }
  );

  // ── PolicyEngineService ────────────────────────────────────────────────────

  app.post("/compliance/policy/check-transfer", async (req, reply) => {
    const parsed = CheckTransferPEBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const res = await call(config.contracts.policyEngine, "checkTransfer", parsed.data);
    return { allowed: Boolean(res["0"]), reason: String(res["1"] ?? "") };
  });

  app.post("/compliance/policy/rule", async (req, reply) => {
    const parsed = AddPolicyRuleBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.policyEngine, "addPolicyRule", parsed.data);
    return { ok: true };
  });

  app.delete<{ Params: { ruleId: string } }>("/compliance/policy/rule/:ruleId", async (req) => {
    await tx(config.contracts.policyEngine, "removePolicyRule", { ruleId: req.params.ruleId });
    return { ok: true };
  });

  app.post("/compliance/policy/default", async (req, reply) => {
    const parsed = SetDefaultPolicyBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.policyEngine, "setDefaultPolicy", parsed.data);
    return { ok: true };
  });

  // ── ShariahComplianceService ───────────────────────────────────────────────

  app.post("/compliance/shariah/approve-sukuk", async (req, reply) => {
    const parsed = ApproveSukukBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.shariahCompliance, "approveSukuk", parsed.data);
    return { ok: true };
  });

  app.post("/compliance/shariah/certify-profit", async (req, reply) => {
    const parsed = CertifyProfitBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const res = await call(config.contracts.shariahCompliance, "certifyProfitDistribution", parsed.data);
    return { compliant: Boolean(res["0"]) };
  });

  app.post("/compliance/shariah/event", async (req, reply) => {
    const parsed = ReportShariahEventBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.shariahCompliance, "reportShariahEvent", parsed.data);
    return { ok: true };
  });

  app.get<{ Querystring: { bondId: string } }>("/compliance/shariah/approval", async (req, reply) => {
    const { bondId } = req.query;
    if (!bondId) return reply.code(400).send({ error: "bondId required" });
    const res = await call(config.contracts.shariahCompliance, "getShariahApproval", { bondId });
    return { approved: Boolean(res["0"]), board: String(res["1"] ?? "") };
  });

  app.get<{ Querystring: { bondId: string } }>("/compliance/shariah/profit-distribution", async (req, reply) => {
    const { bondId } = req.query;
    if (!bondId) return reply.code(400).send({ error: "bondId required" });
    const res = await call(config.contracts.shariahCompliance, "getProfitDistribution", { bondId });
    const d = res["0"] as Record<string, unknown>;
    return {
      totalProfit:            String(d?.totalProfit ?? "0"),
      investorShare:          String(d?.investorShare ?? "0"),
      certified:              Boolean(d?.certified),
      certificationTimestamp: String(d?.certificationTimestamp ?? "0"),
    };
  });

  app.get<{ Querystring: { bondId: string } }>("/compliance/shariah/events", async (req, reply) => {
    const { bondId } = req.query;
    if (!bondId) return reply.code(400).send({ error: "bondId required" });
    const res = await call(config.contracts.shariahCompliance, "getShariahEvents", { bondId });
    return { events: res["0"] ?? [] };
  });

  app.get<{ Querystring: { bondId: string } }>("/compliance/shariah/is-approved", async (req, reply) => {
    const { bondId } = req.query;
    if (!bondId) return reply.code(400).send({ error: "bondId required" });
    const res = await call(config.contracts.shariahCompliance, "isSukukApproved", { bondId });
    return { approved: Boolean(res["0"]) };
  });
}
