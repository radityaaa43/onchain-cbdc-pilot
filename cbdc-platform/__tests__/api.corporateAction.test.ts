import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/rbac", () => ({
  requirePermission: vi.fn(async () => ({
    userId: "u1", orgId: "o1",
    orgAddress: "0x0000000000000000000000000000000000000001",
    roles: ["ISSUANCE_OFFICER"],
  })),
}));
vi.mock("@/lib/operations", () => ({
  startOperation: vi.fn(async () => ({ operationId: "op-ca1" })),
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public httpStatus: number) { super(message); }
  },
}));
vi.mock("@/lib/dlt/domains/corporateAction", () => ({
  corporateAction: {
    scheduleCallOption: vi.fn(), executeCallBatch: vi.fn(), executeCallBatchPaginated: vi.fn(),
    registerPutOption: vi.fn(), exercisePutOption: vi.fn(),
    proposeRestructuring: vi.fn(), approveRestructuring: vi.fn(), executeRestructuring: vi.fn(), rejectRestructuring: vi.fn(),
    scheduleTenderOffer: vi.fn(), tenderBonds: vi.fn(), closeTenderOffer: vi.fn(),
    proposeConsent: vi.fn(), voteConsent: vi.fn(), finalizeConsent: vi.fn(),
    lastProposalId: vi.fn(),
  },
}));

import { POST, GET } from "@/app/api/dlt/corporate-action/route";
import { startOperation } from "@/lib/operations";

function postReq(body: unknown) {
  return new Request("http://localhost/api/dlt/corporate-action", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "idem-ca1" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/dlt/corporate-action", () => {
  it("returns 202 for schedule-call-option", async () => {
    const res = await POST(postReq({
      action: "schedule-call-option",
      bondId: "0x" + "bb".repeat(32),
      callDate: 1830000000, callPriceBps: 10200,
    }));
    expect(res.status).toBe(202);
    expect((await res.json()).operationId).toBe("op-ca1");
  });
  it("returns 422 for missing bondId", async () => {
    const res = await POST(postReq({ action: "schedule-call-option", callDate: 1830000000, callPriceBps: 10200 }));
    expect(res.status).toBe(422);
  });
  it("returns 202 for propose-restructuring", async () => {
    const res = await POST(postReq({
      action: "propose-restructuring",
      bondId: "0x" + "bb".repeat(32),
      newCouponRateBps: 400, newMaturityExtDays: 180,
    }));
    expect(res.status).toBe(202);
  });
  it("returns 202 for vote-consent", async () => {
    const res = await POST(postReq({
      action: "vote-consent",
      proposalId: "0x" + "pp".repeat(32),
      inFavor: true,
    }));
    expect(res.status).toBe(202);
  });
  it("returns 400 when idempotency-key missing", async () => {
    const res = await POST(new Request("http://localhost/api/dlt/corporate-action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "execute-call-batch", bondId: "0x" + "bb".repeat(32) }),
    }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/dlt/corporate-action", () => {
  it("returns last-proposal-id", async () => {
    const { corporateAction } = await import("@/lib/dlt/domains/corporateAction");
    (corporateAction.lastProposalId as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ proposalId: "0xprop1" });
    const res = await GET(new Request("http://localhost/api/dlt/corporate-action"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.proposalId).toBe("0xprop1");
  });
});
