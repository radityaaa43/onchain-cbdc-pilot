import Fastify from "fastify";
import { bondAdvancedRoute } from "../src/routes/bond-advanced";
import { tx, call } from "../src/pente";

jest.mock("../src/pente");
const mockTx   = tx   as jest.MockedFunction<typeof tx>;
const mockCall = call as jest.MockedFunction<typeof call>;

const app = Fastify();
app.register(bondAdvancedRoute);
beforeAll(() => app.ready());
afterAll(() => app.close());
beforeEach(() => jest.clearAllMocks());

// ── CustodyService ────────────────────────────────────────────────────────────

test("POST /custody/register-custodian calls registerCustodian tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/custody/register-custodian",
    payload: { custodian: "0xabc" },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "registerCustodian", { custodian: "0xabc" });
  expect(JSON.parse(res.body)).toEqual({ ok: true });
});

test("POST /custody/beneficial-owner calls setBeneficialOwner tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const payload = { bondId: "0xbond", custodian: "0xcust", subAccountId: "0xsub", owner: "0xowner" };
  const res = await app.inject({
    method: "POST", url: "/custody/beneficial-owner",
    payload,
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "setBeneficialOwner", payload);
  expect(JSON.parse(res.body)).toEqual({ ok: true });
});

test("GET /custody/beneficial-owner returns owner", async () => {
  mockCall.mockResolvedValueOnce({ "0": "0xowner123" });
  const res = await app.inject({
    method: "GET",
    url: "/custody/beneficial-owner?bondId=0xbond&custodian=0xcust&subAccountId=0xsub",
  });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ owner: "0xowner123" });
});

test("GET /custody/holdings returns holdings", async () => {
  mockCall.mockResolvedValueOnce({ "0": "5000" });
  const res = await app.inject({
    method: "GET",
    url: "/custody/holdings?custodian=0xcust&bondId=0xbond",
  });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ custodian: "0xcust", bondId: "0xbond", holdings: "5000" });
});

// ── PledgeService ─────────────────────────────────────────────────────────────

test("POST /pledge/create calls createPledge and returns pledgeId", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  mockCall.mockResolvedValueOnce({ "0": "0xpledge123" });
  const payload = { bondId: "0xbond", pledgor: "0xpledor", pledgee: "0xpledgee", amount: 1000, expiryDate: 1800000000 };
  const res = await app.inject({ method: "POST", url: "/pledge/create", payload });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "createPledge", payload);
  expect(JSON.parse(res.body)).toEqual({ pledgeId: "0xpledge123" });
});

test("POST /pledge/create-v2 returns ok", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const payload = { bondId: "0xbond", pledgor: "0xpledor", pledgee: "0xpledgee", amount: 1000, expiryDate: 1800000000 };
  const res = await app.inject({ method: "POST", url: "/pledge/create-v2", payload });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ ok: true });
});

test("POST /pledge/release calls releasePledge tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/pledge/release",
    payload: { pledgeId: "0xpledge123" },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "releasePledge", { pledgeId: "0xpledge123" });
});

test("POST /pledge/enforce calls enforcePledge tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/pledge/enforce",
    payload: { pledgeId: "0xpledge123" },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "enforcePledge", { pledgeId: "0xpledge123" });
});

test("GET /pledge/last-id returns pledgeId", async () => {
  mockCall.mockResolvedValueOnce({ "0": "0xpledgeid" });
  const res = await app.inject({ method: "GET", url: "/pledge/last-id" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ pledgeId: "0xpledgeid" });
});

test("GET /pledge/:pledgeId returns pledge details", async () => {
  mockCall.mockResolvedValueOnce({
    "0": { bondId: "0xbond", pledgor: "0xa", pledgee: "0xb", amount: "1000", expiryDate: "1800000000", status: 0 },
  });
  const res = await app.inject({ method: "GET", url: "/pledge/0xpledge123" });
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body);
  expect(body.pledgeId).toBe("0xpledge123");
  expect(body.status).toBe(0);
});

// ── RepoService ───────────────────────────────────────────────────────────────

test("POST /repo/initiate calls initiateRepo and returns repoId", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  mockCall.mockResolvedValueOnce({ "0": "0xrepo123" });
  const payload = { bondId: "0xbond", seller: "0xseller", buyer: "0xbuyer", amount: 1000, repoRate: 500, tenor: 30 };
  const res = await app.inject({ method: "POST", url: "/repo/initiate", payload });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "initiateRepo", payload);
  expect(JSON.parse(res.body)).toEqual({ repoId: "0xrepo123" });
});

test("POST /repo/initiate-with-haircut returns repoId", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  mockCall.mockResolvedValueOnce({ "0": "0xrepo456" });
  const payload = { bondId: "0xbond", seller: "0xs", buyer: "0xb", amount: 1000, repoRate: 500, tenor: 30, marketPrice: 950, haircut: 5, marginCallThreshold: 10 };
  const res = await app.inject({ method: "POST", url: "/repo/initiate-with-haircut", payload });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ repoId: "0xrepo456" });
});

test("POST /repo/initiate-v2 returns ok", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const payload = { bondId: "0xbond", seller: "0xs", buyer: "0xb", amount: 1000, repoRate: 500, tenor: 30 };
  const res = await app.inject({ method: "POST", url: "/repo/initiate-v2", payload });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ ok: true });
});

test("POST /repo/consent-early-termination returns ok", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({ method: "POST", url: "/repo/consent-early-termination", payload: { repoId: "0xrepo" } });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ ok: true });
});

test("POST /repo/terminate-early returns ok", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({ method: "POST", url: "/repo/terminate-early", payload: { repoId: "0xrepo" } });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ ok: true });
});

test("POST /repo/unwind returns ok", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({ method: "POST", url: "/repo/unwind", payload: { repoId: "0xrepo" } });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ ok: true });
});

test("POST /repo/margin-call calls initiateMarginCall", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({ method: "POST", url: "/repo/margin-call", payload: { repoId: "0xrepo", currentMarketPrice: 920 } });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "initiateMarginCall", { repoId: "0xrepo", currentMarketPrice: 920 });
});

test("POST /repo/margin-call/respond calls respondToMarginCall", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({ method: "POST", url: "/repo/margin-call/respond", payload: { repoId: "0xrepo", amount: 100 } });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "respondToMarginCall", { repoId: "0xrepo", amount: 100 });
});

test("GET /repo/last-id returns repoId", async () => {
  mockCall.mockResolvedValueOnce({ "0": "0xrepoid" });
  const res = await app.inject({ method: "GET", url: "/repo/last-id" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ repoId: "0xrepoid" });
});

test("GET /repo/:repoId returns repo details", async () => {
  mockCall.mockResolvedValueOnce({
    "0": {
      bondId: "0xbond", seller: "0xs", buyer: "0xb", amount: "1000", repoRate: "500",
      haircut: "5", purchasePrice: "950", repurchasePrice: "975", tenor: "30",
      startDate: "1700000000", endDate: "1702592000", status: 0,
      sellerConsentEarlyTermination: false, buyerConsentEarlyTermination: false,
      initialMarketPrice: "950", marginCallThreshold: "10",
      marginCallActive: false, marginCallDeadline: "0",
    },
  });
  const res = await app.inject({ method: "GET", url: "/repo/0xrepo123" });
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body);
  expect(body.repoId).toBe("0xrepo123");
  expect(body.status).toBe(0);
  expect(body.marginCallActive).toBe(false);
});

// ── SecuritiesLendingService ──────────────────────────────────────────────────

test("POST /lending/initiate calls initiateLend and returns lendId", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  mockCall.mockResolvedValueOnce({ "0": "0xlend123" });
  const payload = { bondId: "0xbond", lender: "0xlender", borrower: "0xborrower", amount: 1000, feeRateBps: 50, tenor: 30 };
  const res = await app.inject({ method: "POST", url: "/lending/initiate", payload });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "initiateLend", payload);
  expect(JSON.parse(res.body)).toEqual({ lendId: "0xlend123" });
});

test("POST /lending/initiate-with-haircut returns lendId", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  mockCall.mockResolvedValueOnce({ "0": "0xlend456" });
  const payload = { bondId: "0xbond", lender: "0xl", borrower: "0xb", amount: 1000, feeRateBps: 50, tenor: 30, haircut: 5 };
  const res = await app.inject({ method: "POST", url: "/lending/initiate-with-haircut", payload });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ lendId: "0xlend456" });
});

test("POST /lending/initiate-v2 returns ok", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const payload = { bondId: "0xbond", lender: "0xl", borrower: "0xb", amount: 1000, feeRateBps: 50, tenor: 30 };
  const res = await app.inject({ method: "POST", url: "/lending/initiate-v2", payload });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ ok: true });
});

test("POST /lending/return calls returnSecurities", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({ method: "POST", url: "/lending/return", payload: { lendId: "0xlend" } });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "returnSecurities", { lendId: "0xlend" });
});

test("POST /lending/recall calls recallLoan", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({ method: "POST", url: "/lending/recall", payload: { lendId: "0xlend" } });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "recallLoan", { lendId: "0xlend" });
});

test("POST /lending/default calls defaultOnLoan", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({ method: "POST", url: "/lending/default", payload: { lendId: "0xlend" } });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "defaultOnLoan", { lendId: "0xlend" });
});

test("GET /lending/last-id returns lendId", async () => {
  mockCall.mockResolvedValueOnce({ "0": "0xlendid" });
  const res = await app.inject({ method: "GET", url: "/lending/last-id" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ lendId: "0xlendid" });
});

test("GET /lending/:lendId returns lend details", async () => {
  mockCall.mockResolvedValueOnce({
    "0": {
      bondId: "0xbond", lender: "0xl", borrower: "0xb", amount: "1000",
      lendingFeeRateBps: "50", collateralAmount: "950", haircut: "5",
      startDate: "1700000000", tenor: "30", recallDate: "0", status: 1,
    },
  });
  const res = await app.inject({ method: "GET", url: "/lending/0xlend123" });
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body);
  expect(body.lendId).toBe("0xlend123");
  expect(body.status).toBe(1);
  expect(body.collateralAmount).toBe("950");
});
