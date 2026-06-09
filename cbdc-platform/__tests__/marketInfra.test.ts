import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public httpStatus: number) { super(message); }
  },
}));

import { can } from "@/lib/rbac";

vi.mock("@/lib/dlt/client", () => ({
  dltGet: vi.fn(async () => ({})),
  dltTx:  vi.fn(async () => ({ ok: true })),
}));

import { netting } from "@/lib/dlt/domains/netting";
import { oracle } from "@/lib/dlt/domains/oracle";
import { settlementFailure } from "@/lib/dlt/domains/settlementFailure";
import { dltGet, dltTx } from "@/lib/dlt/client";

const mockGet = dltGet as ReturnType<typeof vi.fn>;
const mockTx  = dltTx  as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("RBAC market infra permissions", () => {
  it("OPERATOR_ADMIN has all 4 new permissions", () => {
    expect(can(["OPERATOR_ADMIN"], "netting.manage")).toBe(true);
    expect(can(["OPERATOR_ADMIN"], "oracle.manage")).toBe(true);
    expect(can(["OPERATOR_ADMIN"], "settlement.view")).toBe(true);
    expect(can(["OPERATOR_ADMIN"], "settlement.manage")).toBe(true);
  });
  it("TRADER can settlement.view but not settlement.manage", () => {
    expect(can(["TRADER"], "settlement.view")).toBe(true);
    expect(can(["TRADER"], "settlement.manage")).toBe(false);
  });
  it("OPS can settlement.view but not netting.manage", () => {
    expect(can(["OPS"], "settlement.view")).toBe(true);
    expect(can(["OPS"], "netting.manage")).toBe(false);
  });
  it("PARTICIPANT_ADMIN can settlement.view", () => {
    expect(can(["PARTICIPANT_ADMIN"], "settlement.view")).toBe(true);
  });
});

describe("netting.openSession", () => {
  it("calls POST /netting/session", async () => {
    mockTx.mockResolvedValueOnce({ sessionId: "0xsess1" });
    const r = await netting.openSession();
    expect(r.sessionId).toBe("0xsess1");
    expect(mockTx).toHaveBeenCalledWith("/netting/session", {});
  });
});

describe("netting.addEntry", () => {
  it("calls POST /netting/session/entry", async () => {
    await netting.addEntry({ sessionId: "0xs", from: "0x1", to: "0x2", amount: 500000 });
    expect(mockTx).toHaveBeenCalledWith("/netting/session/entry", expect.objectContaining({ amount: 500000 }));
  });
});

describe("netting.getSession", () => {
  it("calls GET /netting/session/:sessionId", async () => {
    mockGet.mockResolvedValueOnce({ session: { sessionId: "0xs", status: 0 } });
    const r = await netting.getSession("0xs");
    expect(r.session.status).toBe(0);
    expect(mockGet).toHaveBeenCalledWith("/netting/session/0xs");
  });
});

describe("oracle.setRate", () => {
  it("calls POST /oracle/rate", async () => {
    await oracle.setRate({ bondId: "0xb", rate: 500 });
    expect(mockTx).toHaveBeenCalledWith("/oracle/rate", { bondId: "0xb", rate: 500 });
  });
});

describe("oracle.getPrice", () => {
  it("calls GET /oracle/price/:bondId", async () => {
    mockGet.mockResolvedValueOnce({ bondId: "0xb", price: "1020000" });
    const r = await oracle.getPrice("0xb");
    expect(r.price).toBe("1020000");
    expect(mockGet).toHaveBeenCalledWith("/oracle/price/0xb");
  });
});

describe("settlementFailure.report", () => {
  it("calls POST /settlement-failure/report", async () => {
    await settlementFailure.report({ settlementId: "0xs", reason: 1, details: "InsufficientBonds" });
    expect(mockTx).toHaveBeenCalledWith("/settlement-failure/report", expect.objectContaining({ reason: 1 }));
  });
});

describe("settlementFailure.get", () => {
  it("calls GET /settlement-failure/:settlementId", async () => {
    mockGet.mockResolvedValueOnce({ failure: { settlementId: "0xs", resolved: false } });
    const r = await settlementFailure.get("0xs");
    expect(r.failure.resolved).toBe(false);
    expect(mockGet).toHaveBeenCalledWith("/settlement-failure/0xs");
  });
});
