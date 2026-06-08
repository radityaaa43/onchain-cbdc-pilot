import Fastify from "fastify";
import { cbdcRoute } from "../src/routes/cbdc";
import { tx, call } from "../src/pente";

jest.mock("../src/pente");
const mockTx = tx as jest.MockedFunction<typeof tx>;
const mockCall = call as jest.MockedFunction<typeof call>;

const app = Fastify();
app.register(cbdcRoute);
beforeAll(() => app.ready());
afterAll(() => app.close());
beforeEach(() => jest.clearAllMocks());

test("POST /cbdc/issue calls issue tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/cbdc/issue",
    payload: { to: "0xabc", amount: 1000 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(
    expect.any(String), "issue", { to: "0xabc", amount: 1000 }
  );
});

test("POST /cbdc/issue returns 400 on missing fields", async () => {
  const res = await app.inject({
    method: "POST", url: "/cbdc/issue",
    payload: { to: "0xabc" },
  });
  expect(res.statusCode).toBe(400);
});

test("POST /cbdc/transfer calls transfer tx", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({
    method: "POST", url: "/cbdc/transfer",
    payload: { from: "0xabc", to: "0xdef", amount: 500 },
  });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(
    expect.any(String), "transfer", { from: "0xabc", to: "0xdef", amount: 500 }
  );
});

test("GET /cbdc/balance/:address returns balance", async () => {
  mockCall.mockResolvedValueOnce({ "0": "5000" });
  const res = await app.inject({ method: "GET", url: "/cbdc/balance/0xabc" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ address: "0xabc", balance: "5000" });
});

test("GET /cbdc/issued-total returns total", async () => {
  mockCall.mockResolvedValueOnce({ "0": "100000" });
  const res = await app.inject({ method: "GET", url: "/cbdc/issued-total" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ total: "100000" });
});
