import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/rbac", () => ({
  requirePermission: vi.fn(async () => ({
    userId: "u1", orgId: "o1",
    orgAddress: "0x0000000000000000000000000000000000000001",
    roles: ["TRADER"],
  })),
}));
vi.mock("@/lib/operations", () => ({
  startOperation: vi.fn(async () => ({ operationId: "op-sec1" })),
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public httpStatus: number) { super(message); }
  },
}));
vi.mock("@/lib/dlt/domains/repo", () => ({
  repo: { initiate: vi.fn(), initiateWithHaircut: vi.fn(), consentEarlyTermination: vi.fn(),
          terminateEarly: vi.fn(), unwind: vi.fn(), marginCall: vi.fn(), marginCallRespond: vi.fn(),
          lastId: vi.fn(), get: vi.fn() },
}));
vi.mock("@/lib/dlt/domains/lending", () => ({
  lending: { initiate: vi.fn(), initiateWithHaircut: vi.fn(), return: vi.fn(),
             recall: vi.fn(), default: vi.fn(), lastId: vi.fn(), get: vi.fn() },
}));
vi.mock("@/lib/dlt/domains/pledge", () => ({
  pledge: { create: vi.fn(), release: vi.fn(), enforce: vi.fn(), lastId: vi.fn(), get: vi.fn() },
}));
vi.mock("@/lib/dlt/domains/custody", () => ({
  custody: { registerCustodian: vi.fn(), setBeneficialOwner: vi.fn(), getBeneficialOwner: vi.fn(), getHoldings: vi.fn() },
}));

import { POST as repoPost, GET as repoGet } from "@/app/api/dlt/repo/route";
import { POST as lendPost, GET as lendGet } from "@/app/api/dlt/lending/route";
import { POST as pledgePost, GET as pledgeGet } from "@/app/api/dlt/pledge/route";
import { POST as custodyPost, GET as custodyGet } from "@/app/api/dlt/custody/route";
import { startOperation } from "@/lib/operations";
import { repo } from "@/lib/dlt/domains/repo";
import { lending } from "@/lib/dlt/domains/lending";

function postReq(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "idem-s1" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/dlt/repo", () => {
  it("returns 202 for valid initiate", async () => {
    const res = await repoPost(postReq("http://localhost/api/dlt/repo", {
      action: "initiate",
      bondId: "0x" + "bb".repeat(32),
      seller: "0x0000000000000000000000000000000000000002",
      buyer:  "0x0000000000000000000000000000000000000003",
      amount: 1000000, repoRate: 250, tenor: 7,
    }));
    expect(res.status).toBe(202);
    expect((await res.json()).operationId).toBe("op-sec1");
  });
  it("returns 422 for missing fields", async () => {
    const res = await repoPost(postReq("http://localhost/api/dlt/repo", { action: "initiate", bondId: "0xbad" }));
    expect(res.status).toBe(422);
  });
  it("returns 400 when idempotency-key missing", async () => {
    const res = await repoPost(new Request("http://localhost/api/dlt/repo", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "unwind", repoId: "0x" + "cc".repeat(32) }),
    }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/dlt/repo", () => {
  it("returns 400 when repoId missing", async () => {
    const res = await repoGet(new Request("http://localhost/api/dlt/repo"));
    expect(res.status).toBe(400);
  });
  it("calls repo.get when repoId provided", async () => {
    (repo.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ repoId: "0x" + "cc".repeat(32), status: 0 });
    const res = await repoGet(new Request("http://localhost/api/dlt/repo?repoId=0x" + "cc".repeat(32)));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/dlt/lending", () => {
  it("returns 202 for valid initiate", async () => {
    const res = await lendPost(postReq("http://localhost/api/dlt/lending", {
      action: "initiate",
      bondId: "0x" + "bb".repeat(32),
      lender:   "0x0000000000000000000000000000000000000002",
      borrower: "0x0000000000000000000000000000000000000003",
      amount: 1000000, feeRateBps: 100, tenor: 30,
    }));
    expect(res.status).toBe(202);
  });
  it("returns 422 for invalid body", async () => {
    const res = await lendPost(postReq("http://localhost/api/dlt/lending", { action: "recall" }));
    expect(res.status).toBe(422);
  });
});
