import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/dlt/client", () => ({
  dltGet: vi.fn(async () => ({})),
  dltTx: vi.fn(async () => ({ ok: true })),
}));

import { complianceGeneral } from "@/lib/dlt/domains/complianceGeneral";
import { dltGet, dltTx } from "@/lib/dlt/client";

const mockGet = dltGet as ReturnType<typeof vi.fn>;
const mockTx = dltTx as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("complianceGeneral.setEligible", () => {
  it("calls POST /compliance/participant/eligible", async () => {
    await complianceGeneral.setEligible({ participant: "0xa", assetId: "0xb", eligible: true });
    expect(mockTx).toHaveBeenCalledWith("/compliance/participant/eligible", { participant: "0xa", assetId: "0xb", eligible: true });
  });
});

describe("complianceGeneral.setSuspended", () => {
  it("calls POST /compliance/participant/suspended", async () => {
    await complianceGeneral.setSuspended({ participant: "0xa", suspended: true, reason: "AML" });
    expect(mockTx).toHaveBeenCalledWith("/compliance/participant/suspended", { participant: "0xa", suspended: true, reason: "AML" });
  });
});

describe("complianceGeneral.setRiskCategory", () => {
  it("calls POST /compliance/participant/risk-category", async () => {
    await complianceGeneral.setRiskCategory({ participant: "0xa", riskCategory: "HIGH" });
    expect(mockTx).toHaveBeenCalledWith("/compliance/participant/risk-category", { participant: "0xa", riskCategory: "HIGH" });
  });
});

describe("complianceGeneral.reportSuspicious", () => {
  it("calls POST /compliance/report-suspicious", async () => {
    await complianceGeneral.reportSuspicious({ entity: "0xa", reason: "unusual" });
    expect(mockTx).toHaveBeenCalledWith("/compliance/report-suspicious", { entity: "0xa", reason: "unusual", data: "0x" });
  });
});

describe("complianceGeneral.status", () => {
  it("calls GET /compliance/status with query params", async () => {
    mockGet.mockResolvedValueOnce({ isEligible: true, isSuspended: false, lastReviewDate: "0", riskCategory: "LOW" });
    const r = await complianceGeneral.status({ entity: "0xa", assetId: "0xb" });
    expect(r.riskCategory).toBe("LOW");
    expect(mockGet).toHaveBeenCalledWith("/compliance/status?entity=0xa&assetId=0xb");
  });
});

describe("complianceGeneral.checkTransfer", () => {
  it("calls GET /compliance/check-transfer", async () => {
    mockGet.mockResolvedValueOnce({ allowed: false, reason: "suspended" });
    const r = await complianceGeneral.checkTransfer({ from: "0x1", to: "0x2", assetId: "0xb" });
    expect(r.allowed).toBe(false);
    expect(mockGet).toHaveBeenCalledWith("/compliance/check-transfer?from=0x1&to=0x2&assetId=0xb");
  });
});
