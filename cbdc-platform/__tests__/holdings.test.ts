import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ db: { instrument: { findMany: vi.fn(async () => [
  { id: "i1", name: "FR0100", symbol: "FR0100", bondId: "0x" + "11".repeat(32), assetType: "SBN", maturityDate: null, couponRateBps: 600 },
  { id: "i2", name: "wIDR", symbol: "wIDR", bondId: null, assetType: "CBDC", maturityDate: null, couponRateBps: null },
]) } } }));
vi.mock("@/lib/dlt/domains/bonds", () => ({ bonds: { balance: vi.fn(async (_b: string, _h: string, state: string) => ({ bondId: "x", balance: state === "PRIMARY" ? "1000" : "250" })) } }));

import { getBondHoldings } from "@/lib/dlt/services/holdings";

beforeEach(() => vi.clearAllMocks());

describe("getBondHoldings", () => {
  it("returns only bond instruments with summed PRIMARY+SECONDARY balances for the holder", async () => {
    const rows = await getBondHoldings("0x" + "02".repeat(20));
    expect(rows).toHaveLength(1);
    expect(rows[0].symbol).toBe("FR0100");
    expect(rows[0].primary).toBe("1000");
    expect(rows[0].secondary).toBe("250");
    expect(rows[0].total).toBe("1250");
  });
});
