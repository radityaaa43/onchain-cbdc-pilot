import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/dlt/client", () => ({
  dltGet: vi.fn(async () => ({})),
  dltTx:  vi.fn(async () => ({ ok: true })),
}));

import { lending } from "@/lib/dlt/domains/lending";
import { dltGet, dltTx } from "@/lib/dlt/client";

const mockGet = dltGet as ReturnType<typeof vi.fn>;
const mockTx  = dltTx  as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("lending.initiate", () => {
  it("calls POST /lending/initiate", async () => {
    mockTx.mockResolvedValueOnce({ lendId: "0xlend1" });
    const r = await lending.initiate({ bondId: "0xb", lender: "0x1", borrower: "0x2", amount: 1000000, feeRateBps: 100, tenor: 30 });
    expect(r.lendId).toBe("0xlend1");
    expect(mockTx).toHaveBeenCalledWith("/lending/initiate", expect.objectContaining({ feeRateBps: 100 }));
  });
});

describe("lending.recall", () => {
  it("calls POST /lending/recall", async () => {
    await lending.recall("0xl1");
    expect(mockTx).toHaveBeenCalledWith("/lending/recall", { lendId: "0xl1" });
  });
});

describe("lending.get", () => {
  it("calls GET /lending/:lendId", async () => {
    mockGet.mockResolvedValueOnce({ lendId: "0xl1", status: 0 });
    const r = await lending.get("0xl1");
    expect(r.status).toBe(0);
    expect(mockGet).toHaveBeenCalledWith("/lending/0xl1");
  });
});
