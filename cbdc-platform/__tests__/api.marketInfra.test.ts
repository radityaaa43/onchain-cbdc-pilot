import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/rbac", () => ({
  requirePermission: vi.fn(async () => ({
    userId: "u1", orgId: "o1",
    orgAddress: "0x0000000000000000000000000000000000000001",
    roles: ["OPERATOR_ADMIN"],
  })),
}));
vi.mock("@/lib/operations", () => ({
  startOperation: vi.fn(async () => ({ operationId: "op-mi1" })),
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public httpStatus: number) { super(message); }
  },
}));
vi.mock("@/lib/dlt/domains/netting", () => ({
  netting: { openSession: vi.fn(), addEntry: vi.fn(), settle: vi.fn(), cancel: vi.fn(), getSession: vi.fn(), getEntries: vi.fn() },
}));
vi.mock("@/lib/dlt/domains/oracle", () => ({
  oracle: { setRate: vi.fn(), setPrice: vi.fn(), creditEvent: vi.fn(), getRate: vi.fn(), getPrice: vi.fn(), getCreditEvent: vi.fn() },
}));
vi.mock("@/lib/dlt/domains/settlementFailure", () => ({
  settlementFailure: { report: vi.fn(), retry: vi.fn(), escalate: vi.fn(), buyInInitiate: vi.fn(), buyInExecute: vi.fn(), get: vi.fn(), getBuyIn: vi.fn() },
}));

import { POST as nettingPost, GET as nettingGet } from "@/app/api/dlt/netting/route";
import { POST as oraclePost, GET as oracleGet } from "@/app/api/dlt/oracle/route";
import { POST as sfPost, GET as sfGet } from "@/app/api/dlt/settlement-failure/route";
import { netting } from "@/lib/dlt/domains/netting";
import { oracle } from "@/lib/dlt/domains/oracle";
import { settlementFailure } from "@/lib/dlt/domains/settlementFailure";

function postReq(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "idem-mi1" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/dlt/netting", () => {
  it("returns 202 for open-session", async () => {
    const res = await nettingPost(postReq("http://localhost/api/dlt/netting", { action: "open-session" }));
    expect(res.status).toBe(202);
    expect((await res.json()).operationId).toBe("op-mi1");
  });
  it("returns 202 for add-entry", async () => {
    const res = await nettingPost(postReq("http://localhost/api/dlt/netting", {
      action: "add-entry",
      sessionId: "0x" + "ab".repeat(32),
      from: "0x0000000000000000000000000000000000000002",
      to:   "0x0000000000000000000000000000000000000003",
      amount: 500000,
    }));
    expect(res.status).toBe(202);
  });
  it("returns 422 for add-entry missing fields", async () => {
    const res = await nettingPost(postReq("http://localhost/api/dlt/netting", { action: "add-entry", sessionId: "0x" + "ab".repeat(32) }));
    expect(res.status).toBe(422);
  });
});

describe("GET /api/dlt/netting", () => {
  it("returns 400 when sessionId missing", async () => {
    const res = await nettingGet(new Request("http://localhost/api/dlt/netting"));
    expect(res.status).toBe(400);
  });
  it("calls netting.getSession when sessionId provided", async () => {
    (netting.getSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ session: { sessionId: "0xs", status: 0 } });
    const res = await nettingGet(new Request("http://localhost/api/dlt/netting?sessionId=0x" + "ab".repeat(32)));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/dlt/oracle", () => {
  it("returns 202 for set-rate", async () => {
    const res = await oraclePost(postReq("http://localhost/api/dlt/oracle", {
      action: "set-rate", bondId: "0x" + "bb".repeat(32), rate: 500,
    }));
    expect(res.status).toBe(202);
  });
  it("returns 422 for missing bondId", async () => {
    const res = await oraclePost(postReq("http://localhost/api/dlt/oracle", { action: "set-rate", rate: 500 }));
    expect(res.status).toBe(422);
  });
});

describe("GET /api/dlt/oracle", () => {
  it("returns 400 when bondId missing for rate", async () => {
    const res = await oracleGet(new Request("http://localhost/api/dlt/oracle?type=rate"));
    expect(res.status).toBe(400);
  });
  it("calls oracle.getRate when type=rate and bondId provided", async () => {
    (oracle.getRate as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ bondId: "0xb", rate: "500" });
    const res = await oracleGet(new Request("http://localhost/api/dlt/oracle?type=rate&bondId=0x" + "bb".repeat(32)));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/dlt/settlement-failure", () => {
  it("returns 202 for report", async () => {
    const res = await sfPost(postReq("http://localhost/api/dlt/settlement-failure", {
      action: "report",
      settlementId: "0x" + "ab".repeat(32),
      reason: 1, details: "InsufficientBonds",
    }));
    expect(res.status).toBe(202);
  });
  it("returns 202 for retry", async () => {
    const res = await sfPost(postReq("http://localhost/api/dlt/settlement-failure", {
      action: "retry", settlementId: "0x" + "ab".repeat(32),
    }));
    expect(res.status).toBe(202);
  });
});

describe("GET /api/dlt/settlement-failure", () => {
  it("returns 400 when settlementId missing", async () => {
    const res = await sfGet(new Request("http://localhost/api/dlt/settlement-failure"));
    expect(res.status).toBe(400);
  });
  it("calls settlementFailure.get when settlementId provided", async () => {
    (settlementFailure.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ failure: { settlementId: "0xs", resolved: false } });
    const res = await sfGet(new Request("http://localhost/api/dlt/settlement-failure?settlementId=0x" + "ab".repeat(32)));
    expect(res.status).toBe(200);
  });
});
