import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: string[] = [];
vi.mock("@/lib/dlt/domains/bonds", () => ({ bonds: { register: vi.fn(async () => { calls.push("register"); return { bondId: "0x" + "11".repeat(32) }; }) } }));
vi.mock("@/lib/dlt/domains/bondMetadata", () => ({ bondMetadata: { setStatic: vi.fn(async () => { calls.push("static"); return { ok: true }; }), setTerms: vi.fn(async () => ({ ok: true })), setRatings: vi.fn(async () => ({ ok: true })), setIndonesian: vi.fn(async () => ({ ok: true })) } }));
vi.mock("@/lib/dlt/domains/coupon", () => ({ coupon: { setRate: vi.fn(async () => { calls.push("rate"); return { ok: true }; }) } }));
vi.mock("@/lib/dlt/domains/maturity", () => ({ maturity: { setInfo: vi.fn(async () => { calls.push("maturity"); return { ok: true }; }) } }));
vi.mock("@/lib/dlt/domains/shariah", () => ({ shariah: { approveSukuk: vi.fn(async () => { calls.push("sukuk"); return { ok: true }; }) } }));

import { createBondOnChain } from "@/lib/dlt/services/assetCreate";

beforeEach(() => { calls.length = 0; });

describe("createBondOnChain", () => {
  it("runs register → metadata → rate → maturity for an SBN and returns bondId", async () => {
    const r = await createBondOnChain({ assetType: "SBN", name: "FR0100", symbol: "FR0100", currency: "IDR", maturityDate: 1893456000, couponRateBps: 600, principalAmount: 1_000_000_000, finalRedemptionPct: 10000 });
    expect(r.bondId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(calls).toEqual(["register", "static", "rate", "maturity"]);
  });
  it("additionally calls approveSukuk for a sukuk", async () => {
    await createBondOnChain({ assetType: "SUKUK_IJARAH", name: "PBS", symbol: "PBS", currency: "IDR", maturityDate: 1893456000, couponRateBps: 600, principalAmount: 1_000_000_000, finalRedemptionPct: 10000, shariahBoard: "0x" + "22".repeat(20) });
    expect(calls).toContain("sukuk");
  });
});
