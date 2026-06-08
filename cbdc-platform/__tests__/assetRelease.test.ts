import { describe, it, expect, vi, beforeEach } from "vitest";
const issued: any[] = [];
vi.mock("@/lib/dlt/domains/cbdc", () => ({ cbdc: { issue: vi.fn(async (b: any) => { issued.push(b); return { ok: true }; }) } }));

import { releaseCash } from "@/lib/dlt/services/assetRelease";

beforeEach(() => { issued.length = 0; });

describe("releaseCash", () => {
  it("calls cbdc.issue with the target + amount", async () => {
    const r = await releaseCash({ to: "0x" + "02".repeat(20), amount: 1_000_000 });
    expect(r.ok).toBe(true);
    expect(issued[0]).toEqual({ to: "0x" + "02".repeat(20), amount: 1_000_000 });
  });
});
