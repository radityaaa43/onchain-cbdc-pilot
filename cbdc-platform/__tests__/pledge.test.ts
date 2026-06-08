import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/dlt/client", () => ({
  dltGet: vi.fn(async () => ({})),
  dltTx:  vi.fn(async () => ({ ok: true })),
}));

import { pledge } from "@/lib/dlt/domains/pledge";
import { custody } from "@/lib/dlt/domains/custody";
import { dltGet, dltTx } from "@/lib/dlt/client";

const mockGet = dltGet as ReturnType<typeof vi.fn>;
const mockTx  = dltTx  as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("pledge.create", () => {
  it("calls POST /pledge/create", async () => {
    mockTx.mockResolvedValueOnce({ pledgeId: "0xpledge1" });
    const r = await pledge.create({ bondId: "0xb", pledgor: "0x1", pledgee: "0x2", amount: 1000000, expiryDate: 1850000000 });
    expect(r.pledgeId).toBe("0xpledge1");
    expect(mockTx).toHaveBeenCalledWith("/pledge/create", expect.objectContaining({ amount: 1000000 }));
  });
});

describe("pledge.release", () => {
  it("calls POST /pledge/release", async () => {
    await pledge.release("0xp1");
    expect(mockTx).toHaveBeenCalledWith("/pledge/release", { pledgeId: "0xp1" });
  });
});

describe("pledge.get", () => {
  it("calls GET /pledge/:pledgeId", async () => {
    mockGet.mockResolvedValueOnce({ pledgeId: "0xp1", status: 0 });
    const r = await pledge.get("0xp1");
    expect(r.status).toBe(0);
    expect(mockGet).toHaveBeenCalledWith("/pledge/0xp1");
  });
});

describe("custody.getHoldings", () => {
  it("calls GET /custody/holdings with correct query string", async () => {
    mockGet.mockResolvedValueOnce({ custodian: "0xc", bondId: "0xb", holdings: "5000000" });
    const r = await custody.getHoldings({ custodian: "0xc", bondId: "0xb" });
    expect(r.holdings).toBe("5000000");
    expect(mockGet).toHaveBeenCalledWith("/custody/holdings?custodian=0xc&bondId=0xb");
  });
});

describe("custody.registerCustodian", () => {
  it("calls POST /custody/register-custodian", async () => {
    await custody.registerCustodian("0xc");
    expect(mockTx).toHaveBeenCalledWith("/custody/register-custodian", { custodian: "0xc" });
  });
});
