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

import { corporateAction } from "@/lib/dlt/domains/corporateAction";
import { dltGet, dltTx } from "@/lib/dlt/client";

const mockGet = dltGet as ReturnType<typeof vi.fn>;
const mockTx  = dltTx  as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("RBAC corporate permissions", () => {
  it("OPERATOR_ADMIN has corporate.view and corporate.manage", () => {
    expect(can(["OPERATOR_ADMIN"], "corporate.view")).toBe(true);
    expect(can(["OPERATOR_ADMIN"], "corporate.manage")).toBe(true);
  });
  it("ISSUANCE_OFFICER has corporate.view and corporate.manage", () => {
    expect(can(["ISSUANCE_OFFICER"], "corporate.view")).toBe(true);
    expect(can(["ISSUANCE_OFFICER"], "corporate.manage")).toBe(true);
  });
  it("TRADER cannot corporate.manage", () => {
    expect(can(["TRADER"], "corporate.manage")).toBe(false);
  });
});

describe("corporateAction.scheduleCallOption", () => {
  it("calls POST /corporate-action/schedule-call-option", async () => {
    await corporateAction.scheduleCallOption({ bondId: "0xb", callDate: 1830000000, callPriceBps: 10200 });
    expect(mockTx).toHaveBeenCalledWith("/corporate-action/schedule-call-option", expect.objectContaining({ callPriceBps: 10200 }));
  });
});

describe("corporateAction.proposeRestructuring", () => {
  it("calls POST /corporate-action/propose-restructuring", async () => {
    await corporateAction.proposeRestructuring({ bondId: "0xb", newCouponRateBps: 400, newMaturityExtDays: 180 });
    expect(mockTx).toHaveBeenCalledWith("/corporate-action/propose-restructuring", expect.objectContaining({ newCouponRateBps: 400 }));
  });
});

describe("corporateAction.proposalId", () => {
  it("calls GET /corporate-action/last-proposal-id", async () => {
    mockGet.mockResolvedValueOnce({ proposalId: "0xprop1" });
    const r = await corporateAction.lastProposalId();
    expect(r.proposalId).toBe("0xprop1");
    expect(mockGet).toHaveBeenCalledWith("/corporate-action/last-proposal-id");
  });
});

describe("corporateAction.voteConsent", () => {
  it("calls POST /corporate-action/vote-consent", async () => {
    await corporateAction.voteConsent({ proposalId: "0xp", inFavor: true });
    expect(mockTx).toHaveBeenCalledWith("/corporate-action/vote-consent", { proposalId: "0xp", inFavor: true });
  });
});
