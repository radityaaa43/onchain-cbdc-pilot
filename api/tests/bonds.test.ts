import Fastify from "fastify";
import { bondsRoute } from "../src/routes/bonds";
import { tx, call } from "../src/pente";

jest.mock("../src/pente");
const mockTx = tx as jest.MockedFunction<typeof tx>;
const mockCall = call as jest.MockedFunction<typeof call>;

const app = Fastify();
app.register(bondsRoute);
beforeAll(() => app.ready());
afterAll(() => app.close());
beforeEach(() => jest.clearAllMocks());

test("POST /bonds/register calls registerBond tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  mockCall.mockResolvedValueOnce({ "0": "0xbondid123" });
  const res = await app.inject({
    method: "POST", url: "/bonds/register",
    payload: { maturityDate: 1800000000 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(
    expect.any(String), "registerBond",
    expect.objectContaining({ maturityDate: 1800000000 })
  );
  expect(JSON.parse(res.body)).toEqual({ bondId: "0xbondid123" });
});

test("POST /bonds/:bondId/issue calls issueBond tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const bondId = "0x" + "a".repeat(64);
  const res = await app.inject({
    method: "POST", url: `/bonds/${bondId}/issue`,
    payload: { investor: "0xabc", amount: 10000 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(
    expect.any(String), "issueBond",
    { bondId, investor: "0xabc", amount: 10000 }
  );
});

test("GET /bonds/last-id returns bondId", async () => {
  mockCall.mockResolvedValueOnce({ "0": "0xdeadbeef" });
  const res = await app.inject({ method: "GET", url: "/bonds/last-id" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ bondId: "0xdeadbeef" });
});

test("GET /bonds/:bondId/balance returns balance", async () => {
  mockCall.mockResolvedValueOnce({ "0": "10000" });
  const bondId = "0x" + "a".repeat(64);
  const res = await app.inject({
    method: "GET",
    url: `/bonds/${bondId}/balance?state=PRIMARY&holder=0xabc`,
  });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ bondId, balance: "10000" });
});
