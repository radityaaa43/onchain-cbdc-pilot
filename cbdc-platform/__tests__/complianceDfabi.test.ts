import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/dlt/client", () => ({
  dltGet: vi.fn(async () => ({})),
  dltTx: vi.fn(async () => ({ ok: true })),
}));

import { complianceDfabi } from "@/lib/dlt/domains/complianceDfabi";
import { dltGet, dltTx } from "@/lib/dlt/client";

const mockGet = dltGet as ReturnType<typeof vi.fn>;
const mockTx = dltTx as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("complianceDfabi.setEligible", () => {
  it("calls POST /compliance/dfabi/eligible", async () => {
    await complianceDfabi.setEligible({ participant: "0xabc", eligible: true });
    expect(mockTx).toHaveBeenCalledWith("/compliance/dfabi/eligible", { participant: "0xabc", eligible: true });
  });
});

describe("complianceDfabi.setEligibleByBond", () => {
  it("calls POST /compliance/dfabi/eligible-by-bond", async () => {
    await complianceDfabi.setEligibleByBond({ participant: "0xabc", bondId: "0x" + "11".repeat(32), eligible: false });
    expect(mockTx).toHaveBeenCalledWith("/compliance/dfabi/eligible-by-bond", expect.objectContaining({ eligible: false }));
  });
});

describe("complianceDfabi.setRestriction", () => {
  it("calls POST /compliance/dfabi/restriction", async () => {
    await complianceDfabi.setRestriction({ bondId: "0x" + "11".repeat(32), restriction: { minAmount: 1000, maxAmount: 1000000 } });
    expect(mockTx).toHaveBeenCalledWith("/compliance/dfabi/restriction", expect.any(Object));
  });
});

describe("complianceDfabi.checkTransfer", () => {
  it("calls GET with correct query string", async () => {
    mockGet.mockResolvedValueOnce({ allowed: true, reason: "" });
    const r = await complianceDfabi.checkTransfer({ bondId: "0xb", from: "0x1", to: "0x2", amount: 500 });
    expect(r.allowed).toBe(true);
    expect(mockGet).toHaveBeenCalledWith("/compliance/dfabi/check-transfer?bondId=0xb&from=0x1&to=0x2&amount=500");
  });
});

describe("complianceDfabi.eligibility", () => {
  it("calls GET /compliance/dfabi/eligibility", async () => {
    mockGet.mockResolvedValueOnce({ eligible: false });
    const r = await complianceDfabi.eligibility({ participant: "0xabc", bondId: "0xb" });
    expect(r.eligible).toBe(false);
    expect(mockGet).toHaveBeenCalledWith("/compliance/dfabi/eligibility?participant=0xabc&bondId=0xb");
  });
});
