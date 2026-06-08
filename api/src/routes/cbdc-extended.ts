import { FastifyInstance } from "fastify";
import { z } from "zod";
import { tx, call } from "../pente";
import { config } from "../config";

// ── CBDCRedemptionService ──────────────────────────────────────────────────

const RequestRedemptionBody = z.object({ user: z.string(), amount: z.number().positive() });
const ProcessRedemptionBody = z.object({ requestId: z.string() });
const RedeemBody            = z.object({ account: z.string(), amount: z.number().positive() });
const BatchRedeemBody       = z.object({
  accounts: z.array(z.string()).min(1),
  amounts:  z.array(z.number().positive()).min(1),
});

// ── CBDCBalanceLimitService ────────────────────────────────────────────────

const SetLimitBody   = z.object({ account: z.string(), limit: z.number().nonnegative() });
const CheckLimitBody = z.object({ account: z.string(), amount: z.number().nonnegative() });

// ── CBDCDailyLimitService ──────────────────────────────────────────────────

const SetDailyLimitBody       = z.object({ account: z.string(), limit: z.number().nonnegative() });
const CheckAndRecordSpendBody = z.object({ account: z.string(), amount: z.number().nonnegative() });

// ── Plugin ─────────────────────────────────────────────────────────────────

export async function cbdcExtendedRoute(app: FastifyInstance): Promise<void> {

  // ── CBDCRedemptionService ──────────────────────────────────────────────

  app.post("/redemption/request", async (req, reply) => {
    const parsed = RequestRedemptionBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const res = await tx(config.contracts.cbdcRedemption, "requestRedemption", parsed.data);
    return { ok: true, requestId: res?.["0"] ?? null };
  });

  app.post("/redemption/process", async (req, reply) => {
    const parsed = ProcessRedemptionBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.cbdcRedemption, "processRedemption", parsed.data);
    return { ok: true };
  });

  app.post("/redemption/redeem", async (req, reply) => {
    const parsed = RedeemBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const res = await tx(config.contracts.cbdcRedemption, "redeem", parsed.data);
    return { ok: true, result: Boolean(res?.["0"]) };
  });

  app.post("/redemption/batch-redeem", async (req, reply) => {
    const parsed = BatchRedeemBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const res = await tx(config.contracts.cbdcRedemption, "batchRedeem", parsed.data);
    return { ok: true, result: Boolean(res?.["0"]) };
  });

  app.get<{ Params: { requestId: string } }>("/redemption/request/:requestId", async (req) => {
    const res = await call(config.contracts.cbdcRedemption, "getRedemptionRequest", {
      requestId: req.params.requestId,
    });
    return {
      user:      String(res["0"]),
      amount:    String(res["1"]),
      processed: Boolean(res["2"]),
      timestamp: String(res["3"]),
    };
  });

  app.get<{ Params: { address: string } }>("/redemption/completed/:address", async (req) => {
    const res = await call(config.contracts.cbdcRedemption, "getCompletedRedemptions", {
      user: req.params.address,
    });
    return { address: req.params.address, redemptions: res["0"] };
  });

  app.get<{ Params: { address: string } }>("/redemption/total/:address", async (req) => {
    const res = await call(config.contracts.cbdcRedemption, "getRedemptionTotal", {
      account: req.params.address,
    });
    return { address: req.params.address, total: String(res["0"]) };
  });

  // ── CBDCBalanceLimitService ──────────────────────────────────────────────

  app.post("/balance-limit/set", async (req, reply) => {
    const parsed = SetLimitBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.cbdcBalanceLimit, "setLimit", parsed.data);
    return { ok: true };
  });

  app.get<{ Params: { address: string } }>("/balance-limit/:address", async (req) => {
    const res = await call(config.contracts.cbdcBalanceLimit, "getLimit", {
      account: req.params.address,
    });
    return { address: req.params.address, limit: String(res["0"]) };
  });

  app.get<{ Params: { address: string }; Querystring: { amount: string } }>(
    "/balance-limit/:address/check", async (req, reply) => {
      const amount = Number(req.query.amount);
      if (!req.query.amount || isNaN(amount)) {
        return reply.code(400).send({ error: "amount query param required" });
      }
      const parsed = CheckLimitBody.safeParse({ account: req.params.address, amount });
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const res = await call(config.contracts.cbdcBalanceLimit, "checkLimit", parsed.data);
      return { address: req.params.address, amount, allowed: Boolean(res["0"]) };
    }
  );

  // ── CBDCDailyLimitService ──────────────────────────────────────────────

  app.post("/daily-limit/set", async (req, reply) => {
    const parsed = SetDailyLimitBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.cbdcDailyLimit, "setDailyLimit", parsed.data);
    return { ok: true };
  });

  app.get<{ Params: { address: string } }>("/daily-limit/:address", async (req) => {
    const res = await call(config.contracts.cbdcDailyLimit, "getDailyLimit", {
      account: req.params.address,
    });
    return { address: req.params.address, limit: String(res["0"]) };
  });

  app.get<{ Params: { address: string } }>("/daily-limit/:address/spent", async (req) => {
    const res = await call(config.contracts.cbdcDailyLimit, "getDailySpent", {
      account: req.params.address,
    });
    return { address: req.params.address, spent: String(res["0"]) };
  });

  app.post("/daily-limit/check-spend", async (req, reply) => {
    const parsed = CheckAndRecordSpendBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const res = await tx(config.contracts.cbdcDailyLimit, "checkAndRecordSpend", parsed.data);
    return { ok: true, allowed: Boolean(res?.["0"]) };
  });
}
