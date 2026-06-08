import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/dlt/client", () => ({
  dltGet: vi.fn(async () => ({})),
  dltTx: vi.fn(async () => ({ ok: true })),
}));

import { reporting } from "@/lib/dlt/domains/reporting";
import { dltGet, dltTx } from "@/lib/dlt/client";

const mockGet = dltGet as ReturnType<typeof vi.fn>;
const mockTx = dltTx as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("reporting.logTransaction", () => {
  it("calls POST /reporting/transaction", async () => {
    await reporting.logTransaction({ assetId: "0xa", from: "0x1", to: "0x2", amount: 1000, ref: "0x0" });
    expect(mockTx).toHaveBeenCalledWith("/reporting/transaction", expect.objectContaining({ amount: 1000 }));
  });
});

describe("reporting.generateSar", () => {
  it("calls POST /reporting/sar", async () => {
    mockTx.mockResolvedValueOnce({ reportId: "0xreport" });
    const r = await reporting.generateSar("0xa");
    expect(r.reportId).toBe("0xreport");
    expect(mockTx).toHaveBeenCalledWith("/reporting/sar", { entity: "0xa" });
  });
});

describe("reporting.transactions", () => {
  it("calls GET with entity + block range", async () => {
    mockGet.mockResolvedValueOnce({ records: [] });
    await reporting.transactions({ entity: "0xa", fromBlock: "0", toBlock: "100" });
    expect(mockGet).toHaveBeenCalledWith("/reporting/transactions?entity=0xa&fromBlock=0&toBlock=100");
  });
});

describe("reporting.exportPaginated", () => {
  it("calls GET /reporting/export/paginated with offset+limit", async () => {
    mockGet.mockResolvedValueOnce({ records: [], total: "0" });
    await reporting.exportPaginated({ offset: 0, limit: 20 });
    expect(mockGet).toHaveBeenCalledWith("/reporting/export/paginated?offset=0&limit=20");
  });
});

describe("reporting.exportRaw", () => {
  it("calls GET /reporting/export with assetId + block range", async () => {
    mockGet.mockResolvedValueOnce({ data: "0x" });
    await reporting.exportRaw({ assetId: "0xa", fromBlock: "0", toBlock: "100" });
    expect(mockGet).toHaveBeenCalledWith("/reporting/export?assetId=0xa&fromBlock=0&toBlock=100");
  });
});
