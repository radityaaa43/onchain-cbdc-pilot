import Fastify from "fastify";
import { complianceRoute } from "../src/routes/compliance";
import { tx, call } from "../src/pente";

jest.mock("../src/pente");
const mockTx   = tx   as jest.MockedFunction<typeof tx>;
const mockCall = call as jest.MockedFunction<typeof call>;

const app = Fastify();
app.register(complianceRoute);
beforeAll(() => app.ready());
afterAll(() => app.close());
beforeEach(() => jest.clearAllMocks());

// ── DFABIComplianceService ────────────────────────────────────────────────────

test("POST /compliance/dfabi/eligible calls setEligible", async () => {
  mockTx.mockResolvedValueOnce({});
  const res = await app.inject({
    method: "POST", url: "/compliance/dfabi/eligible",
    payload: { participant: "0xabc", eligible: true },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "setEligible", { participant: "0xabc", eligible: true });
  expect(JSON.parse(res.body)).toEqual({ ok: true });
});

test("POST /compliance/dfabi/eligible-by-bond calls setEligibleByBond", async () => {
  mockTx.mockResolvedValueOnce({});
  const res = await app.inject({
    method: "POST", url: "/compliance/dfabi/eligible-by-bond",
    payload: { participant: "0xabc", bondId: "0x" + "b".repeat(64), eligible: false },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "setEligibleByBond", expect.objectContaining({ eligible: false }));
});

test("POST /compliance/dfabi/restriction calls setRestriction", async () => {
  mockTx.mockResolvedValueOnce({});
  const res = await app.inject({
    method: "POST", url: "/compliance/dfabi/restriction",
    payload: { bondId: "0x" + "a".repeat(64), restriction: { minAmount: 100, maxAmount: 10000 } },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "setRestriction", expect.objectContaining({ restriction: { minAmount: 100, maxAmount: 10000 } }));
});

test("GET /compliance/dfabi/check-transfer returns allowed/reason", async () => {
  mockCall.mockResolvedValueOnce({ "0": true, "1": "OK" });
  const res = await app.inject({
    method: "GET",
    url: "/compliance/dfabi/check-transfer?bondId=0xbond&from=0xfrom&to=0xto&amount=500",
  });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ allowed: true, reason: "OK" });
});

test("GET /compliance/dfabi/eligibility returns eligible", async () => {
  mockCall.mockResolvedValueOnce({ "0": true });
  const res = await app.inject({
    method: "GET",
    url: "/compliance/dfabi/eligibility?participant=0xp&bondId=0xbond",
  });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ eligible: true });
});

// ── ComplianceService ─────────────────────────────────────────────────────────

test("POST /compliance/participant/eligible calls setEligibleParticipant", async () => {
  mockTx.mockResolvedValueOnce({});
  const res = await app.inject({
    method: "POST", url: "/compliance/participant/eligible",
    payload: { participant: "0xp", assetId: "0xasset", eligible: true },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "setEligibleParticipant", expect.objectContaining({ eligible: true }));
});

test("POST /compliance/participant/suspended calls setParticipantSuspended", async () => {
  mockTx.mockResolvedValueOnce({});
  const res = await app.inject({
    method: "POST", url: "/compliance/participant/suspended",
    payload: { participant: "0xp", suspended: true, reason: "AML flag" },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "setParticipantSuspended", { participant: "0xp", suspended: true, reason: "AML flag" });
});

test("POST /compliance/participant/risk-category calls setRiskCategory", async () => {
  mockTx.mockResolvedValueOnce({});
  const res = await app.inject({
    method: "POST", url: "/compliance/participant/risk-category",
    payload: { participant: "0xp", riskCategory: "HIGH" },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "setRiskCategory", { participant: "0xp", riskCategory: "HIGH" });
});

test("POST /compliance/report-suspicious calls reportSuspiciousActivity", async () => {
  mockTx.mockResolvedValueOnce({});
  const res = await app.inject({
    method: "POST", url: "/compliance/report-suspicious",
    payload: { entity: "0xe", reason: "wash trading" },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "reportSuspiciousActivity", expect.objectContaining({ entity: "0xe", reason: "wash trading" }));
});

test("GET /compliance/participant/eligible returns eligible", async () => {
  mockCall.mockResolvedValueOnce({ "0": false });
  const res = await app.inject({
    method: "GET",
    url: "/compliance/participant/eligible?participant=0xp&assetId=0xa",
  });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ eligible: false });
});

test("GET /compliance/check-transfer returns allowed/reason", async () => {
  mockCall.mockResolvedValueOnce({ "0": true, "1": "" });
  const res = await app.inject({
    method: "GET",
    url: "/compliance/check-transfer?from=0xf&to=0xt&assetId=0xa",
  });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ allowed: true, reason: "" });
});

test("GET /compliance/status returns ComplianceStatus", async () => {
  mockCall.mockResolvedValueOnce({ "0": { isEligible: true, isSuspended: false, lastReviewDate: "1700000000", riskCategory: "LOW" } });
  const res = await app.inject({
    method: "GET",
    url: "/compliance/status?entity=0xe&assetId=0xa",
  });
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body);
  expect(body.isEligible).toBe(true);
  expect(body.riskCategory).toBe("LOW");
});

// ── PolicyEngineService ───────────────────────────────────────────────────────

test("POST /compliance/policy/check-transfer returns allowed", async () => {
  mockCall.mockResolvedValueOnce({ "0": true, "1": "pass" });
  const res = await app.inject({
    method: "POST", url: "/compliance/policy/check-transfer",
    payload: { from: "0xf", to: "0xt", amount: 100, assetId: "0xa" },
  });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ allowed: true, reason: "pass" });
});

test("POST /compliance/policy/rule calls addPolicyRule", async () => {
  mockTx.mockResolvedValueOnce({});
  const res = await app.inject({
    method: "POST", url: "/compliance/policy/rule",
    payload: { ruleId: "0x" + "c".repeat(64), ruleContract: "0xrc" },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "addPolicyRule", expect.objectContaining({ ruleContract: "0xrc" }));
});

test("DELETE /compliance/policy/rule/:ruleId calls removePolicyRule", async () => {
  mockTx.mockResolvedValueOnce({});
  const ruleId = "0x" + "d".repeat(64);
  const res = await app.inject({ method: "DELETE", url: `/compliance/policy/rule/${ruleId}` });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "removePolicyRule", { ruleId });
});

test("POST /compliance/policy/default calls setDefaultPolicy", async () => {
  mockTx.mockResolvedValueOnce({});
  const res = await app.inject({
    method: "POST", url: "/compliance/policy/default",
    payload: { policyAddress: "0xpa" },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "setDefaultPolicy", { policyAddress: "0xpa" });
});

// ── ShariahComplianceService ──────────────────────────────────────────────────

test("POST /compliance/shariah/approve-sukuk calls approveSukuk", async () => {
  mockTx.mockResolvedValueOnce({});
  const bondId = "0x" + "e".repeat(64);
  const res = await app.inject({
    method: "POST", url: "/compliance/shariah/approve-sukuk",
    payload: { bondId, shariahBoard: "0xboard" },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "approveSukuk", { bondId, shariahBoard: "0xboard" });
});

test("POST /compliance/shariah/certify-profit returns compliant", async () => {
  mockCall.mockResolvedValueOnce({ "0": true });
  const res = await app.inject({
    method: "POST", url: "/compliance/shariah/certify-profit",
    payload: { bondId: "0xbond", totalProfit: 1000000, investorShare: 800000 },
  });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ compliant: true });
});

test("POST /compliance/shariah/event calls reportShariahEvent", async () => {
  mockTx.mockResolvedValueOnce({});
  const res = await app.inject({
    method: "POST", url: "/compliance/shariah/event",
    payload: { bondId: "0xbond", eventType: "PROFIT_PAYMENT" },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "reportShariahEvent", { bondId: "0xbond", eventType: "PROFIT_PAYMENT" });
});

test("GET /compliance/shariah/approval returns approved/board", async () => {
  mockCall.mockResolvedValueOnce({ "0": true, "1": "0xboard" });
  const res = await app.inject({ method: "GET", url: "/compliance/shariah/approval?bondId=0xbond" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ approved: true, board: "0xboard" });
});

test("GET /compliance/shariah/profit-distribution returns distribution", async () => {
  mockCall.mockResolvedValueOnce({ "0": { totalProfit: "1000000", investorShare: "800000", certified: true, certificationTimestamp: "1700000000" } });
  const res = await app.inject({ method: "GET", url: "/compliance/shariah/profit-distribution?bondId=0xbond" });
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body);
  expect(body.certified).toBe(true);
  expect(body.totalProfit).toBe("1000000");
});

test("GET /compliance/shariah/events returns events array", async () => {
  mockCall.mockResolvedValueOnce({ "0": [{ eventType: "APPROVAL", timestamp: "1700000000", description: "" }] });
  const res = await app.inject({ method: "GET", url: "/compliance/shariah/events?bondId=0xbond" });
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body);
  expect(Array.isArray(body.events)).toBe(true);
  expect(body.events[0].eventType).toBe("APPROVAL");
});

test("GET /compliance/shariah/is-approved returns approved bool", async () => {
  mockCall.mockResolvedValueOnce({ "0": false });
  const res = await app.inject({ method: "GET", url: "/compliance/shariah/is-approved?bondId=0xbond" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ approved: false });
});
