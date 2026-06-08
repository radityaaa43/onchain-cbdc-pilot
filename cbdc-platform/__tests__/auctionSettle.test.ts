import { describe, it, expect, vi, beforeEach } from "vitest";
const issued: any[] = [];
vi.mock("@/lib/dlt/domains/bonds", () => ({ bonds: { issue: vi.fn(async (bondId: string, b: any) => { issued.push({ bondId, ...b }); return { ok: true }; }) } }));

import { settleAllocation } from "@/lib/dlt/services/auctionSettle";

beforeEach(() => { issued.length = 0; });

describe("settleAllocation", () => {
  it("issues the bond to the winner (primary issuance) and returns a step record", async () => {
    const r = await settleAllocation({ bondId: "0x" + "11".repeat(32), winnerAddress: "0x" + "02".repeat(20), bondAmount: 500000 });
    expect(issued[0]).toEqual({ bondId: "0x" + "11".repeat(32), investor: "0x" + "02".repeat(20), amount: 500000 });
    expect(r.steps.issued).toBe(true);
  });
  it("throws when bondId is missing", async () => {
    await expect(settleAllocation({ bondId: null as any, winnerAddress: "0x" + "02".repeat(20), bondAmount: 1 })).rejects.toThrow();
  });
});
