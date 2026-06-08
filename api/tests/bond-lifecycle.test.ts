import Fastify from "fastify";
import { bondLifecycleRoute } from "../src/routes/bond-lifecycle";
import { tx, call } from "../src/pente";

jest.mock("../src/pente");
const mockTx   = tx   as jest.MockedFunction<typeof tx>;
const mockCall = call as jest.MockedFunction<typeof call>;

const app = Fastify();
app.register(bondLifecycleRoute);
beforeAll(() => app.ready());
afterAll(() => app.close());
beforeEach(() => jest.clearAllMocks());

const BOND_ID    = "0x" + "a".repeat(64);
const PROPOSAL   = "0x" + "b".repeat(64);
const ADDR       = "0x" + "c".repeat(40);

// ── CouponService ─────────────────────────────────────────────────────────────

test("POST /coupon/set-rate calls setCouponRate tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/coupon/set-rate",
    payload: { bondId: BOND_ID, rateBps: 500 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "setCouponRate", { bondId: BOND_ID, rateBps: 500 });
  expect(JSON.parse(res.body)).toEqual({ ok: true });
});

test("POST /coupon/set-day-count calls setBondDayCountConvention tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/coupon/set-day-count",
    payload: { bondId: BOND_ID, convention: 1 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "setBondDayCountConvention", { bondId: BOND_ID, convention: 1 });
});

test("POST /coupon/set-metadata-registry calls setMetadataRegistry tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/coupon/set-metadata-registry",
    payload: { bondId: BOND_ID, registry: ADDR },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "setMetadataRegistry", { bondId: BOND_ID, registry: ADDR });
});

test("GET /coupon/calculate/:bondId returns couponAmount", async () => {
  mockCall.mockResolvedValueOnce({ "0": "1000" });
  const res = await app.inject({ method: "GET", url: `/coupon/calculate/${BOND_ID}` });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ bondId: BOND_ID, couponAmount: "1000" });
});

test("POST /coupon/pay calls payCoupon tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/coupon/pay",
    payload: { bondId: BOND_ID, recipient: ADDR },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "payCoupon", { bondId: BOND_ID, recipient: ADDR });
  expect(JSON.parse(res.body)).toEqual({ ok: true });
});

test("POST /coupon/pay-batch calls payCouponBatch tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/coupon/pay-batch",
    payload: { bondId: BOND_ID },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "payCouponBatch", { bondId: BOND_ID });
  expect(JSON.parse(res.body)).toEqual({ ok: true });
});

test("GET /coupon/status/:bondId/:couponId returns coupon status", async () => {
  const tuple = { couponId: 1, bondId: BOND_ID, amount: 500, paymentDate: 1800000000, isPaid: false };
  mockCall.mockResolvedValueOnce({ "0": tuple });
  const res = await app.inject({ method: "GET", url: `/coupon/status/${BOND_ID}/1` });
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body);
  expect(body.isPaid).toBe(false);
  expect(body.amount).toBe("500");
});

test("GET /coupon/count/:bondId returns count", async () => {
  mockCall.mockResolvedValueOnce({ "0": "3" });
  const res = await app.inject({ method: "GET", url: `/coupon/count/${BOND_ID}` });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ bondId: BOND_ID, count: "3" });
});

// ── MaturityService ───────────────────────────────────────────────────────────

test("POST /maturity/set-redemption-service calls setRedemptionService tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/maturity/set-redemption-service",
    payload: { redemptionService: ADDR },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "setRedemptionService", { redemptionService_: ADDR });
  expect(JSON.parse(res.body)).toEqual({ ok: true });
});

test("POST /maturity/set-info calls setMaturityInfo tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const payload = { bondId: BOND_ID, maturityDate: 1900000000, finalRedemptionPct: 10000, principalAmount: 1000000 };
  const res = await app.inject({ method: "POST", url: "/maturity/set-info", payload });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "setMaturityInfo", payload);
});

test("POST /maturity/trigger calls triggerMaturity tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/maturity/trigger",
    payload: { bondId: BOND_ID },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "triggerMaturity", { bondId: BOND_ID });
});

test("GET /maturity/info/:bondId returns maturity info", async () => {
  const tuple = { bondId: BOND_ID, maturityDate: 1900000000, finalRedemptionPct: 10000, principalAmount: 1000000, isTriggered: false };
  mockCall.mockResolvedValueOnce({ "0": tuple });
  const res = await app.inject({ method: "GET", url: `/maturity/info/${BOND_ID}` });
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body);
  expect(body.isTriggered).toBe(false);
  expect(body.maturityDate).toBe("1900000000");
});

test("GET /maturity/is-matured/:bondId returns matured flag", async () => {
  mockCall.mockResolvedValueOnce({ "0": true });
  const res = await app.inject({ method: "GET", url: `/maturity/is-matured/${BOND_ID}` });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ bondId: BOND_ID, matured: true });
});

test("GET /maturity/matured-count returns count", async () => {
  mockCall.mockResolvedValueOnce({ "0": "7" });
  const res = await app.inject({ method: "GET", url: "/maturity/matured-count" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ count: "7" });
});

// ── MaturityOracle ────────────────────────────────────────────────────────────

test("POST /maturity-oracle/track calls trackBond tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/maturity-oracle/track",
    payload: { bondId: BOND_ID },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "trackBond", { bondId: BOND_ID });
});

test("POST /maturity-oracle/untrack calls untrackBond tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/maturity-oracle/untrack",
    payload: { bondId: BOND_ID },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "untrackBond", { bondId: BOND_ID });
});

test("POST /maturity-oracle/trigger-batch calls triggerMaturityBatch tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({ method: "POST", url: "/maturity-oracle/trigger-batch", payload: {} });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "triggerMaturityBatch", {});
});

test("GET /maturity-oracle/tracked-bonds returns bonds list", async () => {
  mockCall.mockResolvedValueOnce({ "0": [BOND_ID] });
  const res = await app.inject({ method: "GET", url: "/maturity-oracle/tracked-bonds" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ bonds: [BOND_ID] });
});

// ── RedemptionService ─────────────────────────────────────────────────────────

test("POST /redemption/redeem calls redeem tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/redemption/redeem",
    payload: { bondId: BOND_ID, holder: ADDR, amount: 1000 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "redeem", { bondId: BOND_ID, holder: ADDR, amount: 1000 });
  expect(JSON.parse(res.body)).toEqual({ ok: true });
});

test("GET /redemption/redeemed-total/:bondId returns total", async () => {
  mockCall.mockResolvedValueOnce({ "0": "5000" });
  const res = await app.inject({ method: "GET", url: `/redemption/redeemed-total/${BOND_ID}` });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ bondId: BOND_ID, redeemedTotal: "5000" });
});

test("GET /redemption/total/:bondId returns redemption total", async () => {
  mockCall.mockResolvedValueOnce({ "0": "10000" });
  const res = await app.inject({ method: "GET", url: `/redemption/total/${BOND_ID}` });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ bondId: BOND_ID, redemptionTotal: "10000" });
});

test("GET /redemption/funding/:bondId returns funding status", async () => {
  mockCall.mockResolvedValueOnce({ sufficient: true, required: "1000", available: "2000" });
  const res = await app.inject({ method: "GET", url: `/redemption/funding/${BOND_ID}` });
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body);
  expect(body.sufficient).toBe(true);
  expect(body.required).toBe("1000");
  expect(body.available).toBe("2000");
});

// ── TransferService ───────────────────────────────────────────────────────────

test("POST /bond-transfer/transfer calls transfer tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const to = "0x" + "d".repeat(40);
  const res = await app.inject({
    method: "POST", url: "/bond-transfer/transfer",
    payload: { bondId: BOND_ID, from: ADDR, to, amount: 500, data: "0x" },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "transfer", { bondId: BOND_ID, from: ADDR, to, amount: 500, data: "0x" });
  expect(JSON.parse(res.body)).toEqual({ ok: true });
});

test("POST /bond-transfer/batch calls batchTransfer tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const to = "0x" + "d".repeat(40);
  const res = await app.inject({
    method: "POST", url: "/bond-transfer/batch",
    payload: { bondId: BOND_ID, froms: [ADDR], tos: [to], amounts: [100] },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "batchTransfer", { bondId: BOND_ID, froms: [ADDR], tos: [to], amounts: [100] });
});

// ── CorporateActionService ────────────────────────────────────────────────────

test("POST /corporate-action/set-coupon-service calls setCouponService tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/corporate-action/set-coupon-service",
    payload: { couponService: ADDR },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "setCouponService", { _couponService: ADDR });
});

test("POST /corporate-action/schedule-call-option calls scheduleCallOption tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/corporate-action/schedule-call-option",
    payload: { bondId: BOND_ID, callDate: 1850000000, callPriceBps: 10200 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "scheduleCallOption", { bondId: BOND_ID, callDate: 1850000000, callPriceBps: 10200 });
});

test("POST /corporate-action/execute-call-batch calls executeCallBatch tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/corporate-action/execute-call-batch",
    payload: { bondId: BOND_ID },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "executeCallBatch", { bondId: BOND_ID });
});

test("POST /corporate-action/execute-call-batch-paginated calls paginated tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/corporate-action/execute-call-batch-paginated",
    payload: { bondId: BOND_ID, startIndex: 0, endIndex: 10 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "executeCallBatchPaginated", { bondId: BOND_ID, startIndex: 0, endIndex: 10 });
});

test("POST /corporate-action/register-put-option calls registerPutOption tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/corporate-action/register-put-option",
    payload: { bondId: BOND_ID, putDate: 1850000000, putPriceBps: 9800 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "registerPutOption", { bondId: BOND_ID, putDate: 1850000000, putPriceBps: 9800 });
});

test("POST /corporate-action/exercise-put-option calls exercisePutOption tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/corporate-action/exercise-put-option",
    payload: { bondId: BOND_ID, amount: 5000 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "exercisePutOption", { bondId: BOND_ID, amount: 5000 });
});

test("POST /corporate-action/propose-restructuring calls proposeRestructuring tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/corporate-action/propose-restructuring",
    payload: { bondId: BOND_ID, newCouponRateBps: 600, newMaturityExtDays: 365 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "proposeRestructuring", { bondId: BOND_ID, newCouponRateBps: 600, newMaturityExtDays: 365 });
  expect(JSON.parse(res.body)).toEqual({ ok: true });
});

test("POST /corporate-action/propose-restructuring-v2 calls proposeRestructuringV2 tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/corporate-action/propose-restructuring-v2",
    payload: { bondId: BOND_ID, newCouponRateBps: 600, newMaturityExtDays: 365 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "proposeRestructuringV2", { bondId: BOND_ID, newCouponRateBps: 600, newMaturityExtDays: 365 });
});

test("POST /corporate-action/approve-restructuring calls approveRestructuring tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/corporate-action/approve-restructuring",
    payload: { proposalId: PROPOSAL },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "approveRestructuring", { proposalId: PROPOSAL });
});

test("POST /corporate-action/execute-restructuring calls executeRestructuring tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/corporate-action/execute-restructuring",
    payload: { proposalId: PROPOSAL },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "executeRestructuring", { proposalId: PROPOSAL });
});

test("POST /corporate-action/reject-restructuring calls rejectRestructuring tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/corporate-action/reject-restructuring",
    payload: { proposalId: PROPOSAL },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "rejectRestructuring", { proposalId: PROPOSAL });
});

test("POST /corporate-action/schedule-tender-offer calls scheduleTenderOffer tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/corporate-action/schedule-tender-offer",
    payload: { bondId: BOND_ID, openDate: 1800000000, closeDate: 1810000000, tenderPriceBps: 10100 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "scheduleTenderOffer", { bondId: BOND_ID, openDate: 1800000000, closeDate: 1810000000, tenderPriceBps: 10100 });
});

test("POST /corporate-action/tender-bonds calls tenderBonds tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/corporate-action/tender-bonds",
    payload: { bondId: BOND_ID, amount: 3000 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "tenderBonds", { bondId: BOND_ID, amount: 3000 });
});

test("POST /corporate-action/close-tender-offer calls closeTenderOffer tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/corporate-action/close-tender-offer",
    payload: { bondId: BOND_ID },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "closeTenderOffer", { bondId: BOND_ID });
});

test("POST /corporate-action/propose-consent calls proposeConsent tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/corporate-action/propose-consent",
    payload: { bondId: BOND_ID, description: "Consent solicitation", votingDurationDays: 30, quorumBps: 5100 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "proposeConsent", {
    bondId: BOND_ID, description: "Consent solicitation", votingDurationDays: 30, quorumBps: 5100,
  });
  expect(JSON.parse(res.body)).toEqual({ ok: true });
});

test("POST /corporate-action/propose-consent-v2 calls proposeConsentV2 tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/corporate-action/propose-consent-v2",
    payload: { bondId: BOND_ID, votingDurationDays: 30, quorumBps: 5100 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "proposeConsentV2", { bondId: BOND_ID, votingDurationDays: 30, quorumBps: 5100 });
});

test("GET /corporate-action/last-proposal-id returns proposalId", async () => {
  mockCall.mockResolvedValueOnce({ "0": PROPOSAL });
  const res = await app.inject({ method: "GET", url: "/corporate-action/last-proposal-id" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ proposalId: PROPOSAL });
});

test("POST /corporate-action/vote-consent calls voteConsent tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/corporate-action/vote-consent",
    payload: { proposalId: PROPOSAL, inFavor: true },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "voteConsent", { proposalId: PROPOSAL, inFavor: true });
});

test("POST /corporate-action/finalize-consent calls finalizeConsent tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/corporate-action/finalize-consent",
    payload: { proposalId: PROPOSAL },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "finalizeConsent", { proposalId: PROPOSAL });
});

// ── Validation errors ─────────────────────────────────────────────────────────

test("POST /coupon/set-rate with invalid bondId returns 400", async () => {
  const res = await app.inject({
    method: "POST", url: "/coupon/set-rate",
    payload: { bondId: "not-a-bytes32", rateBps: 500 },
  });
  expect(res.statusCode).toBe(400);
});

test("POST /redemption/redeem with missing amount returns 400", async () => {
  const res = await app.inject({
    method: "POST", url: "/redemption/redeem",
    payload: { bondId: BOND_ID, holder: ADDR },
  });
  expect(res.statusCode).toBe(400);
});

test("GET /coupon/calculate/:bondId with invalid bondId returns 400", async () => {
  const res = await app.inject({ method: "GET", url: "/coupon/calculate/0xbad" });
  expect(res.statusCode).toBe(400);
});
