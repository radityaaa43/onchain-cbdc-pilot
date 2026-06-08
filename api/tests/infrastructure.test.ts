import Fastify from "fastify";
import { infrastructureRoute } from "../src/routes/infrastructure";
import { tx, call } from "../src/pente";

jest.mock("../src/pente");
const mockTx   = tx   as jest.MockedFunction<typeof tx>;
const mockCall = call as jest.MockedFunction<typeof call>;

const app = Fastify();
app.register(infrastructureRoute);
beforeAll(() => app.ready());
afterAll(() => app.close());
beforeEach(() => jest.clearAllMocks());

// ── NettingService ────────────────────────────────────────────────────────────

test("POST /netting/session opens a session", async () => {
  mockTx.mockResolvedValueOnce({ sessionId: "0xsession1" } as any);
  const res = await app.inject({ method: "POST", url: "/netting/session" });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "openSession", {});
});

test("POST /netting/session/entry adds entry", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/netting/session/entry",
    payload: { sessionId: "0xsess", from: "0xaaa", to: "0xbbb", amount: 100 },
  });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ ok: true });
});

test("POST /netting/session/:sessionId/settle settles session", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({ method: "POST", url: "/netting/session/0xsess/settle" });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "settleSession", { sessionId: "0xsess" });
});

test("POST /netting/session/:sessionId/cancel cancels session", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({ method: "POST", url: "/netting/session/0xsess/cancel" });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "cancelSession", { sessionId: "0xsess" });
});

test("GET /netting/session/:sessionId returns session", async () => {
  mockCall.mockResolvedValueOnce({ "0": { sessionId: "0xsess", status: 1, createdAt: 100, entryCount: 2 } });
  const res = await app.inject({ method: "GET", url: "/netting/session/0xsess" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toHaveProperty("session");
});

test("GET /netting/session/:sessionId/entries returns entries", async () => {
  mockCall.mockResolvedValueOnce({ "0": [{ from: "0xa", to: "0xb", amount: 50 }] });
  const res = await app.inject({ method: "GET", url: "/netting/session/0xsess/entries" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toHaveProperty("entries");
});

// ── OracleService ─────────────────────────────────────────────────────────────

test("POST /oracle/rate sets rate", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/oracle/rate",
    payload: { bondId: "0xbond1", rate: 500 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "setRate", { bondId: "0xbond1", rate: 500 });
});

test("POST /oracle/price sets price", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/oracle/price",
    payload: { bondId: "0xbond1", price: 1000000 },
  });
  expect(res.statusCode).toBe(200);
});

test("POST /oracle/credit-event reports event", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/oracle/credit-event",
    payload: { bondId: "0xbond1", eventType: "0xdefault", timestamp: 1700000000 },
  });
  expect(res.statusCode).toBe(200);
});

test("GET /oracle/rate/:bondId returns rate", async () => {
  mockCall.mockResolvedValueOnce({ "0": "500" });
  const res = await app.inject({ method: "GET", url: "/oracle/rate/0xbond1" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ bondId: "0xbond1", rate: "500" });
});

test("GET /oracle/price/:bondId returns price", async () => {
  mockCall.mockResolvedValueOnce({ "0": "1000000" });
  const res = await app.inject({ method: "GET", url: "/oracle/price/0xbond1" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ bondId: "0xbond1", price: "1000000" });
});

test("GET /oracle/credit-event/:bondId/:eventType returns timestamp", async () => {
  mockCall.mockResolvedValueOnce({ "0": "1700000000" });
  const res = await app.inject({ method: "GET", url: "/oracle/credit-event/0xbond1/0xdefault" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toHaveProperty("timestamp", "1700000000");
});

// ── ReportingService ──────────────────────────────────────────────────────────

test("POST /reporting/transaction logs a tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/reporting/transaction",
    payload: { assetId: "0xasset", from: "0xaaa", to: "0xbbb", amount: 100, ref: "0xref1" },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "logTransaction", expect.objectContaining({ assetId: "0xasset" }));
});

test("POST /reporting/sar generates SAR", async () => {
  mockTx.mockResolvedValueOnce({ reportId: "0xreport1" } as any);
  const res = await app.inject({
    method: "POST", url: "/reporting/sar",
    payload: { entity: "0xentity" },
  });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ reportId: "0xreport1" });
});

test("GET /reporting/transactions returns records", async () => {
  mockCall.mockResolvedValueOnce({ "0": [] });
  const res = await app.inject({
    method: "GET",
    url: "/reporting/transactions?entity=0xentity&fromBlock=0&toBlock=100",
  });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toHaveProperty("records");
});

test("GET /reporting/export returns data", async () => {
  mockCall.mockResolvedValueOnce({ "0": "0xdata" });
  const res = await app.inject({
    method: "GET",
    url: "/reporting/export?assetId=0xasset&fromBlock=0&toBlock=100",
  });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toHaveProperty("data");
});

test("GET /reporting/export/paginated returns paginated records", async () => {
  mockCall.mockResolvedValueOnce({ "0": [], "1": "0" });
  const res = await app.inject({ method: "GET", url: "/reporting/export/paginated?offset=0&limit=10" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toHaveProperty("records");
  expect(JSON.parse(res.body)).toHaveProperty("total");
});

// ── TokenGatewayService ───────────────────────────────────────────────────────

test("POST /token-gateway/asset creates asset", async () => {
  mockTx.mockResolvedValueOnce({ assetAddress: "0xnewasset" } as any);
  const res = await app.inject({
    method: "POST", url: "/token-gateway/asset",
    payload: { assetType: 0, assetId: "0xasset1" },
  });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ assetAddress: "0xnewasset" });
});

test("GET /token-gateway/asset/:assetId/address returns address", async () => {
  mockCall.mockResolvedValueOnce({ "0": "0xassetaddr" });
  const res = await app.inject({ method: "GET", url: "/token-gateway/asset/0xasset1/address" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ assetId: "0xasset1", address: "0xassetaddr" });
});

test("GET /token-gateway/asset/:assetId/type returns type", async () => {
  mockCall.mockResolvedValueOnce({ "0": 1 });
  const res = await app.inject({ method: "GET", url: "/token-gateway/asset/0xasset1/type" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ assetId: "0xasset1", assetType: 1 });
});

test("GET /token-gateway/asset/:assetId/registered returns bool", async () => {
  mockCall.mockResolvedValueOnce({ "0": true });
  const res = await app.inject({ method: "GET", url: "/token-gateway/asset/0xasset1/registered" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ assetId: "0xasset1", registered: true });
});

// ── SettlementFailureService ──────────────────────────────────────────────────

test("POST /settlement-failure/report reports failure", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/settlement-failure/report",
    payload: { settlementId: "0xsettle1", reason: 1, details: "insufficient funds" },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "reportFailure", expect.objectContaining({ settlementId: "0xsettle1" }));
});

test("POST /settlement-failure/:settlementId/retry retries", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({ method: "POST", url: "/settlement-failure/0xsettle1/retry" });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "retrySettlement", { settlementId: "0xsettle1" });
});

test("POST /settlement-failure/:settlementId/escalate escalates", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({ method: "POST", url: "/settlement-failure/0xsettle1/escalate" });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "escalateToArbitration", { settlementId: "0xsettle1" });
});

test("POST /settlement-failure/:settlementId/buy-in/initiate initiates buy-in", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({ method: "POST", url: "/settlement-failure/0xsettle1/buy-in/initiate" });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "initiateBuyIn", { settlementId: "0xsettle1" });
});

test("POST /settlement-failure/buy-in/execute executes buy-in", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/settlement-failure/buy-in/execute",
    payload: { settlementId: "0xsettle1", buyInAmount: 1000, buyInPriceBps: 10100 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "executeBuyIn", expect.objectContaining({ settlementId: "0xsettle1" }));
});

test("GET /settlement-failure/:settlementId returns failure", async () => {
  mockCall.mockResolvedValueOnce({ "0": { settlementId: "0xsettle1", reason: 1, details: "err", timestamp: 100, resolved: false } });
  const res = await app.inject({ method: "GET", url: "/settlement-failure/0xsettle1" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toHaveProperty("failure");
});

test("GET /settlement-failure/:settlementId/buy-in returns buy-in", async () => {
  mockCall.mockResolvedValueOnce({ "0": { initiated: true, executed: false, initiatedAt: 100, buyInAmount: 1000, buyInPriceBps: 10100, costToDefaulter: 0 } });
  const res = await app.inject({ method: "GET", url: "/settlement-failure/0xsettle1/buy-in" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toHaveProperty("buyIn");
});

// ── BondMetadataRegistry ──────────────────────────────────────────────────────

test("POST /bond-metadata/static sets static data", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/bond-metadata/static",
    payload: { data: { isin: "ID1234567890" } },
  });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ ok: true });
});

test("POST /bond-metadata/terms sets terms", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/bond-metadata/terms",
    payload: { data: { couponRate: 625 } },
  });
  expect(res.statusCode).toBe(200);
});

test("POST /bond-metadata/dlt-platform sets DLT data", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/bond-metadata/dlt-platform",
    payload: { data: { network: "besu" } },
  });
  expect(res.statusCode).toBe(200);
});

test("POST /bond-metadata/credit-events sets credit events", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/bond-metadata/credit-events",
    payload: { data: {} },
  });
  expect(res.statusCode).toBe(200);
});

test("POST /bond-metadata/ratings sets ratings", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/bond-metadata/ratings",
    payload: { data: { moody: "Aaa" } },
  });
  expect(res.statusCode).toBe(200);
});

test("POST /bond-metadata/indonesian-market sets indonesian market data", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/bond-metadata/indonesian-market",
    payload: { data: { sector: "gov" } },
  });
  expect(res.statusCode).toBe(200);
});

test("GET /bond-metadata/static returns static data", async () => {
  mockCall.mockResolvedValueOnce({ "0": { isin: "ID1234567890" } });
  const res = await app.inject({ method: "GET", url: "/bond-metadata/static" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toHaveProperty("data");
});

test("GET /bond-metadata/terms returns terms", async () => {
  mockCall.mockResolvedValueOnce({ "0": {} });
  const res = await app.inject({ method: "GET", url: "/bond-metadata/terms" });
  expect(res.statusCode).toBe(200);
});

test("GET /bond-metadata/syariah returns isSyariah", async () => {
  mockCall.mockResolvedValueOnce({ "0": false });
  const res = await app.inject({ method: "GET", url: "/bond-metadata/syariah" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ isSyariah: false });
});

test("GET /bond-metadata/matured returns isMatured", async () => {
  mockCall.mockResolvedValueOnce({ "0": false });
  const res = await app.inject({ method: "GET", url: "/bond-metadata/matured" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ isMatured: false });
});

test("GET /bond-metadata/interest-type returns interestType", async () => {
  mockCall.mockResolvedValueOnce({ "0": "FIXED" });
  const res = await app.inject({ method: "GET", url: "/bond-metadata/interest-type" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ interestType: "FIXED" });
});
