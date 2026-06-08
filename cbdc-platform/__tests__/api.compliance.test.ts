import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/rbac", () => ({
  requirePermission: vi.fn(async () => ({
    userId: "u1", orgId: "o1",
    orgAddress: "0x0000000000000000000000000000000000000001",
    roles: ["COMPLIANCE_OFFICER"],
  })),
  AuthError: class AuthError extends Error {
    constructor(message: string, public httpStatus: number) { super(message); }
  },
}));
vi.mock("@/lib/operations", () => ({
  startOperation: vi.fn(async () => ({ operationId: "op-c1" })),
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public httpStatus: number) { super(message); }
  },
}));
vi.mock("@/lib/dlt/domains/complianceDfabi", () => ({
  complianceDfabi: { setEligible: vi.fn(), setEligibleByBond: vi.fn(), setRestriction: vi.fn(), checkTransfer: vi.fn(), eligibility: vi.fn() },
}));
vi.mock("@/lib/dlt/domains/complianceGeneral", () => ({
  complianceGeneral: { setEligible: vi.fn(), setSuspended: vi.fn(), setRiskCategory: vi.fn(), reportSuspicious: vi.fn(), eligible: vi.fn(), checkTransfer: vi.fn(), status: vi.fn() },
}));
vi.mock("@/lib/dlt/domains/compliancePolicy", () => ({
  compliancePolicy: { checkTransfer: vi.fn(), addRule: vi.fn(), removeRule: vi.fn(), setDefault: vi.fn() },
}));
vi.mock("@/lib/dlt/domains/shariah", () => ({
  shariah: { approveSukuk: vi.fn(), certifyProfit: vi.fn(), reportEvent: vi.fn(), approval: vi.fn(), profitDistribution: vi.fn(), events: vi.fn(), isApproved: vi.fn() },
}));

import { POST as dfabiPost } from "@/app/api/dlt/compliance/dfabi/route";
import { POST as generalPost } from "@/app/api/dlt/compliance/general/route";
import { POST as policyPost } from "@/app/api/dlt/compliance/policy/route";
import { POST as shariahPost } from "@/app/api/dlt/compliance/shariah/route";
import { startOperation } from "@/lib/operations";

function req(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "idem-1" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/dlt/compliance/dfabi", () => {
  it("returns 422 when eligible body missing participant", async () => {
    const res = await dfabiPost(req("http://localhost/api/dlt/compliance/dfabi", { action: "eligible", eligible: true }));
    expect(res.status).toBe(422);
  });
  it("returns 202 for valid setEligible body", async () => {
    const res = await dfabiPost(req("http://localhost/api/dlt/compliance/dfabi", {
      action: "eligible", participant: "0x0000000000000000000000000000000000000002", eligible: true,
    }));
    expect(res.status).toBe(202);
    expect((await res.json()).operationId).toBe("op-c1");
    expect(startOperation).toHaveBeenCalledOnce();
  });
});

describe("POST /api/dlt/compliance/general", () => {
  it("returns 202 for valid setSuspended body", async () => {
    const res = await generalPost(req("http://localhost/api/dlt/compliance/general", {
      action: "suspend", participant: "0x0000000000000000000000000000000000000002", suspended: true, reason: "AML",
    }));
    expect(res.status).toBe(202);
  });
  it("returns 422 when riskCategory body missing riskCategory field", async () => {
    const res = await generalPost(req("http://localhost/api/dlt/compliance/general", {
      action: "risk-category", participant: "0x0000000000000000000000000000000000000002",
    }));
    expect(res.status).toBe(422);
  });
});

describe("POST /api/dlt/compliance/policy", () => {
  it("returns 202 for addRule action", async () => {
    const res = await policyPost(req("http://localhost/api/dlt/compliance/policy", {
      action: "add-rule",
      ruleId: "0x" + "aa".repeat(32),
      ruleContract: "0x0000000000000000000000000000000000000002",
    }));
    expect(res.status).toBe(202);
  });
});

describe("POST /api/dlt/compliance/shariah", () => {
  it("returns 202 for approveSukuk action", async () => {
    const res = await shariahPost(req("http://localhost/api/dlt/compliance/shariah", {
      action: "approve-sukuk",
      bondId: "0x" + "bb".repeat(32),
      shariahBoard: "0x0000000000000000000000000000000000000003",
    }));
    expect(res.status).toBe(202);
  });
});
