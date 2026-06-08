import Fastify from "fastify";
import { dvpRoute } from "../src/routes/dvp";
import { tx, txWithLogs, call } from "../src/pente";

jest.mock("../src/pente");
const mockTx = tx as jest.MockedFunction<typeof tx>;
const mockTxWithLogs = txWithLogs as jest.MockedFunction<typeof txWithLogs>;
const mockCall = call as jest.MockedFunction<typeof call>;

const app = Fastify();
app.register(dvpRoute);
beforeAll(() => app.ready());
afterAll(() => app.close());
beforeEach(() => jest.clearAllMocks());

const settlementId = "0x" + "b".repeat(64);
const bondId = "0x" + "a".repeat(64);

test("POST /dvp/initiate returns settlementId", async () => {
  mockTxWithLogs.mockResolvedValueOnce({
    logs: [{ topics: ["0xevent", settlementId] }],
  });
  const res = await app.inject({
    method: "POST", url: "/dvp/initiate",
    payload: {
      bondId, bondSeller: "0xabc", bondBuyer: "0xdef",
      bondAmount: 1000, bondPartition: "0x" + "c".repeat(64),
      cbdcPayer: "0xabc", cbdcPayee: "0xdef",
      cbdcAmount: 50000, model: 0,
    },
  });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ settlementId });
});

test("POST /dvp/:settlementId/confirm calls confirmDVP", async () => {
  mockTx.mockResolvedValueOnce(undefined);
  const res = await app.inject({ method: "POST", url: `/dvp/${settlementId}/confirm` });
  expect(res.statusCode).toBe(200);
  expect(mockTx).toHaveBeenCalledWith(expect.any(String), "confirmDVP", { settlementId });
});

test("GET /dvp/:settlementId/status returns settlement", async () => {
  mockCall.mockResolvedValueOnce({ s: { status: 1, bondId, cbdcAmount: "50000" } });
  const res = await app.inject({ method: "GET", url: `/dvp/${settlementId}/status` });
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body);
  expect(body.settlement.status).toBe(1);
});
