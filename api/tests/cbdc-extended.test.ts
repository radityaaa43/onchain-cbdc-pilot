import Fastify from "fastify";
import { cbdcExtendedRoute } from "../src/routes/cbdc-extended";
import { tx, call } from "../src/pente";

jest.mock("../src/pente");
const mockTx   = tx   as jest.MockedFunction<typeof tx>;
const mockCall = call as jest.MockedFunction<typeof call>;

const app = Fastify();
app.register(cbdcExtendedRoute);
beforeAll(() => app.ready());
afterAll(() => app.close());
beforeEach(() => jest.clearAllMocks());

// ── CBDCRedemptionService ──────────────────────────────────────────────────

test("POST /redemption/request calls requestRedemption tx", async () => {
  mockTx.mockResolvedValueOnce({ "0": "0xdeadbeef" } as any);
  const res = await app.inject({
    method: "POST", url: "/redemption/request",
    payload: { user: "0xabc", amount: 500 },
  });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toMatchObject({ ok: true });
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "requestRedemption", { user: "0xabc", amount: 500 });
});

test("POST /redemption/request returns 400 on missing fields", async () => {
  const res = await app.inject({
    method: "POST", url: "/redemption/request",
    payload: { user: "0xabc" },
  });
  expect(res.statusCode).toBe(400);
});

test("POST /redemption/process calls processRedemption tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/redemption/process",
    payload: { requestId: "0xreqid" },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "processRedemption", { requestId: "0xreqid" });
});

test("POST /redemption/redeem calls redeem tx", async () => {
  mockTx.mockResolvedValueOnce({ "0": true } as any);
  const res = await app.inject({
    method: "POST", url: "/redemption/redeem",
    payload: { account: "0xabc", amount: 100 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "redeem", { account: "0xabc", amount: 100 });
});

test("POST /redemption/batch-redeem calls batchRedeem tx", async () => {
  mockTx.mockResolvedValueOnce({ "0": true } as any);
  const res = await app.inject({
    method: "POST", url: "/redemption/batch-redeem",
    payload: { accounts: ["0xabc", "0xdef"], amounts: [100, 200] },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(
    expect.any(String), "batchRedeem",
    { accounts: ["0xabc", "0xdef"], amounts: [100, 200] }
  );
});

test("GET /redemption/request/:requestId returns request info", async () => {
  mockCall.mockResolvedValueOnce({ "0": "0xuser", "1": "500", "2": false, "3": "1717900000" });
  const res = await app.inject({ method: "GET", url: "/redemption/request/0xreqid" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({
    user: "0xuser", amount: "500", processed: false, timestamp: "1717900000",
  });
});

test("GET /redemption/completed/:address returns list", async () => {
  mockCall.mockResolvedValueOnce({ "0": ["0xid1", "0xid2"] });
  const res = await app.inject({ method: "GET", url: "/redemption/completed/0xabc" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ address: "0xabc", redemptions: ["0xid1", "0xid2"] });
});

test("GET /redemption/total/:address returns total", async () => {
  mockCall.mockResolvedValueOnce({ "0": "9000" });
  const res = await app.inject({ method: "GET", url: "/redemption/total/0xabc" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ address: "0xabc", total: "9000" });
});

// ── CBDCBalanceLimitService ────────────────────────────────────────────────

test("POST /balance-limit/set calls setLimit tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/balance-limit/set",
    payload: { account: "0xabc", limit: 10000 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "setLimit", { account: "0xabc", limit: 10000 });
});

test("GET /balance-limit/:address returns limit", async () => {
  mockCall.mockResolvedValueOnce({ "0": "10000" });
  const res = await app.inject({ method: "GET", url: "/balance-limit/0xabc" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ address: "0xabc", limit: "10000" });
});

test("GET /balance-limit/:address/check returns allowed", async () => {
  mockCall.mockResolvedValueOnce({ "0": true });
  const res = await app.inject({ method: "GET", url: "/balance-limit/0xabc/check?amount=500" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toMatchObject({ allowed: true });
});

test("GET /balance-limit/:address/check returns 400 without amount", async () => {
  const res = await app.inject({ method: "GET", url: "/balance-limit/0xabc/check" });
  expect(res.statusCode).toBe(400);
});

// ── CBDCDailyLimitService ──────────────────────────────────────────────────

test("POST /daily-limit/set calls setDailyLimit tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/daily-limit/set",
    payload: { account: "0xabc", limit: 5000 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "setDailyLimit", { account: "0xabc", limit: 5000 });
});

test("GET /daily-limit/:address returns limit", async () => {
  mockCall.mockResolvedValueOnce({ "0": "5000" });
  const res = await app.inject({ method: "GET", url: "/daily-limit/0xabc" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ address: "0xabc", limit: "5000" });
});

test("GET /daily-limit/:address/spent returns spent", async () => {
  mockCall.mockResolvedValueOnce({ "0": "1200" });
  const res = await app.inject({ method: "GET", url: "/daily-limit/0xabc/spent" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ address: "0xabc", spent: "1200" });
});

test("POST /daily-limit/check-spend calls checkAndRecordSpend tx", async () => {
  mockTx.mockResolvedValueOnce({ "0": true } as any);
  const res = await app.inject({
    method: "POST", url: "/daily-limit/check-spend",
    payload: { account: "0xabc", amount: 300 },
  });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toMatchObject({ ok: true, allowed: true });
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "checkAndRecordSpend", { account: "0xabc", amount: 300 });
});
