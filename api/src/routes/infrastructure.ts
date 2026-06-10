import { FastifyInstance } from "fastify";
import { ethers } from "ethers";
import { z } from "zod";
import { tx, txWithLogs, call } from "../pente";
import { config } from "../config";

// ─── NettingService ──────────────────────────────────────────────────────────

const AddEntryBody = z.object({
  sessionId: z.string(),
  from:      z.string(),
  to:        z.string(),
  amount:    z.number().positive(),
});

// ─── OracleService ───────────────────────────────────────────────────────────

const SetRateBody = z.object({ bondId: z.string(), rate: z.number().nonnegative() });
const SetPriceBody = z.object({ bondId: z.string(), price: z.number().nonnegative() });
const ReportCreditEventBody = z.object({
  bondId:    z.string(),
  eventType: z.string(),
  timestamp: z.number().nonnegative(),
});

// ─── ReportingService ────────────────────────────────────────────────────────

const LogTransactionBody = z.object({
  assetId: z.string(),
  from:    z.string(),
  to:      z.string(),
  amount:  z.number().positive(),
  ref:     z.string(),
});
const GenerateSARBody = z.object({ entity: z.string() });

// ─── TokenGatewayService ─────────────────────────────────────────────────────

const CreateAssetBody = z.object({
  assetType: z.number().int().min(0),
  assetId:   z.string(),
  initData:  z.string().default("0x"),
});

// ─── SettlementFailureService ────────────────────────────────────────────────

const ReportFailureBody = z.object({
  settlementId: z.string(),
  reason:       z.number().int().min(0),
  details:      z.string(),
});
const ExecuteBuyInBody = z.object({
  settlementId:  z.string(),
  buyInAmount:   z.number().positive(),
  buyInPriceBps: z.number().nonnegative(),
});

// ─── BondMetadataRegistry ────────────────────────────────────────────────────

const TupleDataBody  = z.object({ data: z.record(z.unknown()) });
const EventsBody     = z.object({ data: z.record(z.unknown()) });
const RatingsBody    = z.object({ data: z.record(z.unknown()) });
const IndonesianBody = z.object({ data: z.record(z.unknown()) });

// ─── Plugin ──────────────────────────────────────────────────────────────────

export async function infrastructureRoute(app: FastifyInstance): Promise<void> {

  // ── NettingService ──────────────────────────────────────────────────────

  app.post("/netting/session", async (_req, _reply) => {
    const { logs } = await txWithLogs(config.contracts.netting, "openSession", {});
    const EVENT_SIG = ethers.id("NettingSessionOpened(bytes32)");
    const log = logs.find(l => l.topics[0] === EVENT_SIG);
    const sessionId = log?.topics[1] ?? "";
    return { sessionId };
  });

  app.post("/netting/session/entry", async (req, reply) => {
    const parsed = AddEntryBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.netting, "addEntry", parsed.data);
    return { ok: true };
  });

  app.post<{ Params: { sessionId: string } }>("/netting/session/:sessionId/settle", async (req, _reply) => {
    await tx(config.contracts.netting, "settleSession", { sessionId: req.params.sessionId });
    return { ok: true };
  });

  app.post<{ Params: { sessionId: string } }>("/netting/session/:sessionId/cancel", async (req, _reply) => {
    await tx(config.contracts.netting, "cancelSession", { sessionId: req.params.sessionId });
    return { ok: true };
  });

  app.get<{ Params: { sessionId: string } }>("/netting/session/:sessionId", async (req) => {
    const res = await call(config.contracts.netting, "getSession", { sessionId: req.params.sessionId });
    return { session: res["0"] };
  });

  app.get<{ Params: { sessionId: string } }>("/netting/session/:sessionId/entries", async (req) => {
    const res = await call(config.contracts.netting, "getEntries", { sessionId: req.params.sessionId });
    return { entries: res["0"] };
  });

  // ── OracleService ───────────────────────────────────────────────────────

  app.post("/oracle/rate", async (req, reply) => {
    const parsed = SetRateBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.oracle, "setRate", parsed.data);
    return { ok: true };
  });

  app.post("/oracle/price", async (req, reply) => {
    const parsed = SetPriceBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.oracle, "setPrice", parsed.data);
    return { ok: true };
  });

  app.post("/oracle/credit-event", async (req, reply) => {
    const parsed = ReportCreditEventBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.oracle, "reportCreditEvent", parsed.data);
    return { ok: true };
  });

  app.get<{ Params: { bondId: string } }>("/oracle/rate/:bondId", async (req) => {
    const res = await call(config.contracts.oracle, "getRate", { bondId: req.params.bondId });
    return { bondId: req.params.bondId, rate: String(res["0"]) };
  });

  app.get<{ Params: { bondId: string } }>("/oracle/price/:bondId", async (req) => {
    const res = await call(config.contracts.oracle, "getPrice", { bondId: req.params.bondId });
    return { bondId: req.params.bondId, price: String(res["0"]) };
  });

  app.get<{ Params: { bondId: string; eventType: string } }>("/oracle/credit-event/:bondId/:eventType", async (req) => {
    const res = await call(config.contracts.oracle, "getCreditEvent", {
      bondId:    req.params.bondId,
      eventType: req.params.eventType,
    });
    return { bondId: req.params.bondId, eventType: req.params.eventType, timestamp: String(res["0"]) };
  });

  // ── ReportingService ────────────────────────────────────────────────────

  app.post("/reporting/transaction", async (req, reply) => {
    const parsed = LogTransactionBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.reporting, "logTransaction", parsed.data);
    return { ok: true };
  });

  app.post("/reporting/sar", async (req, reply) => {
    const parsed = GenerateSARBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const res = await tx(config.contracts.reporting, "generateSAR", parsed.data);
    return { reportId: String((res as unknown as Record<string, unknown>)?.["reportId"] ?? "") };
  });

  app.get<{ Querystring: { entity: string; fromBlock: string; toBlock: string } }>("/reporting/transactions", async (req, reply) => {
    const { entity, fromBlock, toBlock } = req.query;
    if (!entity || !fromBlock || !toBlock) return reply.code(400).send({ error: "entity, fromBlock, toBlock required" });
    const res = await call(config.contracts.reporting, "getTransactions", {
      entity,
      fromBlock: Number(fromBlock),
      toBlock:   Number(toBlock),
    });
    return { records: res["0"] };
  });

  app.get<{ Querystring: { assetId: string; fromBlock: string; toBlock: string } }>("/reporting/export", async (req, reply) => {
    const { assetId, fromBlock, toBlock } = req.query;
    if (!assetId || !fromBlock || !toBlock) return reply.code(400).send({ error: "assetId, fromBlock, toBlock required" });
    const res = await call(config.contracts.reporting, "exportTransactionLog", {
      assetId,
      fromBlock: Number(fromBlock),
      toBlock:   Number(toBlock),
    });
    return { data: res["0"] };
  });

  app.get<{ Querystring: { offset?: string; limit?: string } }>("/reporting/export/paginated", async (req) => {
    const offset = Number(req.query.offset ?? 0);
    const limit  = Number(req.query.limit  ?? 20);
    const res = await call(config.contracts.reporting, "exportTransactionLogPaginated", { offset, limit });
    return { records: res["records"] ?? res["0"], total: String(res["total"] ?? res["1"]) };
  });

  // ── TokenGatewayService ─────────────────────────────────────────────────

  app.post("/token-gateway/asset", async (req, reply) => {
    const parsed = CreateAssetBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const res = await tx(config.contracts.tokenGateway, "createAsset", parsed.data);
    return { assetAddress: String((res as unknown as Record<string, unknown>)?.["assetAddress"] ?? "") };
  });

  app.get<{ Params: { assetId: string } }>("/token-gateway/asset/:assetId/address", async (req) => {
    const res = await call(config.contracts.tokenGateway, "getAssetAddress", { assetId: req.params.assetId });
    return { assetId: req.params.assetId, address: String(res["0"]) };
  });

  app.get<{ Params: { assetId: string } }>("/token-gateway/asset/:assetId/type", async (req) => {
    const res = await call(config.contracts.tokenGateway, "getAssetType", { assetId: req.params.assetId });
    return { assetId: req.params.assetId, assetType: Number(res["0"]) };
  });

  app.get<{ Params: { assetId: string } }>("/token-gateway/asset/:assetId/registered", async (req) => {
    const res = await call(config.contracts.tokenGateway, "isAssetRegistered", { assetId: req.params.assetId });
    return { assetId: req.params.assetId, registered: Boolean(res["0"]) };
  });

  // ── SettlementFailureService ────────────────────────────────────────────

  app.post("/settlement-failure/report", async (req, reply) => {
    const parsed = ReportFailureBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.settlementFailure, "reportFailure", parsed.data);
    return { ok: true };
  });

  app.post<{ Params: { settlementId: string } }>("/settlement-failure/:settlementId/retry", async (req, _reply) => {
    await tx(config.contracts.settlementFailure, "retrySettlement", { settlementId: req.params.settlementId });
    return { ok: true };
  });

  app.post<{ Params: { settlementId: string } }>("/settlement-failure/:settlementId/escalate", async (req, _reply) => {
    await tx(config.contracts.settlementFailure, "escalateToArbitration", { settlementId: req.params.settlementId });
    return { ok: true };
  });

  app.post<{ Params: { settlementId: string } }>("/settlement-failure/:settlementId/buy-in/initiate", async (req, _reply) => {
    await tx(config.contracts.settlementFailure, "initiateBuyIn", { settlementId: req.params.settlementId });
    return { ok: true };
  });

  app.post("/settlement-failure/buy-in/execute", async (req, reply) => {
    const parsed = ExecuteBuyInBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.settlementFailure, "executeBuyIn", parsed.data);
    return { ok: true };
  });

  app.get<{ Params: { settlementId: string } }>("/settlement-failure/:settlementId", async (req) => {
    const res = await call(config.contracts.settlementFailure, "getFailure", { settlementId: req.params.settlementId });
    return { failure: res["0"] };
  });

  app.get<{ Params: { settlementId: string } }>("/settlement-failure/:settlementId/buy-in", async (req) => {
    const res = await call(config.contracts.settlementFailure, "getBuyIn", { settlementId: req.params.settlementId });
    return { buyIn: res["0"] };
  });

  // ── BondMetadataRegistry ────────────────────────────────────────────────

  app.post("/bond-metadata/static", async (req, reply) => {
    const parsed = TupleDataBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.bondMetadata, "setBondStaticData", { data: parsed.data.data });
    return { ok: true };
  });

  app.post("/bond-metadata/terms", async (req, reply) => {
    const parsed = TupleDataBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.bondMetadata, "setBondTerms", { data: parsed.data.data });
    return { ok: true };
  });

  app.post("/bond-metadata/dlt-platform", async (req, reply) => {
    const parsed = TupleDataBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.bondMetadata, "setDltPlatformData", { data: parsed.data.data });
    return { ok: true };
  });

  app.post("/bond-metadata/credit-events", async (req, reply) => {
    const parsed = EventsBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.bondMetadata, "setCreditEvents", { events: parsed.data.data });
    return { ok: true };
  });

  app.post("/bond-metadata/ratings", async (req, reply) => {
    const parsed = RatingsBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.bondMetadata, "setBondRatings", { ratings: parsed.data.data });
    return { ok: true };
  });

  app.post("/bond-metadata/indonesian-market", async (req, reply) => {
    const parsed = IndonesianBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.bondMetadata, "setIndonesianMarketData", { data: parsed.data.data });
    return { ok: true };
  });

  app.get("/bond-metadata/static", async () => {
    const res = await call(config.contracts.bondMetadata, "bondStaticData", {});
    return { data: res["0"] };
  });

  app.get("/bond-metadata/terms", async () => {
    const res = await call(config.contracts.bondMetadata, "bondTerms", {});
    return { data: res["0"] };
  });

  app.get("/bond-metadata/dlt-platform", async () => {
    const res = await call(config.contracts.bondMetadata, "dltPlatformData", {});
    return { data: res["0"] };
  });

  app.get("/bond-metadata/credit-events", async () => {
    const res = await call(config.contracts.bondMetadata, "creditEvents", {});
    return { data: res["0"] };
  });

  app.get("/bond-metadata/ratings", async () => {
    const res = await call(config.contracts.bondMetadata, "bondRatings", {});
    return { data: res["0"] };
  });

  app.get("/bond-metadata/indonesian-market", async () => {
    const res = await call(config.contracts.bondMetadata, "indonesianMarketData", {});
    return { data: res["0"] };
  });

  app.get("/bond-metadata/syariah", async () => {
    const res = await call(config.contracts.bondMetadata, "isSyariah", {});
    return { isSyariah: Boolean(res["0"]) };
  });

  app.get("/bond-metadata/matured", async () => {
    const res = await call(config.contracts.bondMetadata, "bondMetadataIsMatured", {});
    return { isMatured: Boolean(res["0"]) };
  });

  app.get("/bond-metadata/interest-type", async () => {
    const res = await call(config.contracts.bondMetadata, "interestType", {});
    return { interestType: String(res["0"]) };
  });
}
