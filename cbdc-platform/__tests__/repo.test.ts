import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/dlt/client", () => ({
  dltGet: vi.fn(async () => ({})),
  dltTx:  vi.fn(async () => ({ ok: true })),
}));

import { repo } from "@/lib/dlt/domains/repo";
import { dltGet, dltTx } from "@/lib/dlt/client";

const mockGet = dltGet as ReturnType<typeof vi.fn>;
const mockTx  = dltTx  as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("repo.initiate", () => {
  it("calls POST /repo/initiate", async () => {
    mockTx.mockResolvedValueOnce({ repoId: "0xabc" });
    const r = await repo.initiate({ bondId: "0xb", seller: "0x1", buyer: "0x2", amount: 1000000, repoRate: 250, tenor: 7 });
    expect(r.repoId).toBe("0xabc");
    expect(mockTx).toHaveBeenCalledWith("/repo/initiate", expect.objectContaining({ repoRate: 250 }));
  });
});

describe("repo.unwind", () => {
  it("calls POST /repo/unwind", async () => {
    await repo.unwind("0xr1");
    expect(mockTx).toHaveBeenCalledWith("/repo/unwind", { repoId: "0xr1" });
  });
});

describe("repo.marginCall", () => {
  it("calls POST /repo/margin-call with repoId and price", async () => {
    await repo.marginCall({ repoId: "0xr1", currentMarketPrice: 980000 });
    expect(mockTx).toHaveBeenCalledWith("/repo/margin-call", { repoId: "0xr1", currentMarketPrice: 980000 });
  });
});

describe("repo.get", () => {
  it("calls GET /repo/:repoId", async () => {
    mockGet.mockResolvedValueOnce({ repoId: "0xr1", status: 0 });
    const r = await repo.get("0xr1");
    expect(r.status).toBe(0);
    expect(mockGet).toHaveBeenCalledWith("/repo/0xr1");
  });
});
