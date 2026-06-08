import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn(), AuthError: class AuthError extends Error { httpStatus: number; constructor(msg: string, status = 401) { super(msg); this.httpStatus = status; } } }));
vi.mock("@/lib/rbac", () => ({ requirePermission: vi.fn(async () => ({ userId: "u1", orgId: "o1", orgAddress: "0x" + "01".repeat(20), roles: ["ISSUANCE_OFFICER"] })) }));
const created: any[] = [];
vi.mock("@/lib/db", () => ({ db: { instrument: { create: vi.fn(async ({ data }: any) => { const i = { id: "inst-1", ...data }; created.push(i); return i; }), findMany: vi.fn(async () => created) } } }));
vi.mock("@/lib/operations", () => ({ runOperation: vi.fn(async (_c: any, exec: any) => { const r = await exec(); return { id: "op-1", status: "SUCCESS", ...r }; }) }));
vi.mock("@/lib/dlt/services/assetCreate", () => ({ createBondOnChain: vi.fn(async () => ({ bondId: "0x" + "33".repeat(32) })) }));
vi.mock("@/lib/env", () => ({ env: { APP_ROLE: "operator", DLT_API_URL: "x", DLT_API_KEY: "k", ORG_ID: "o1", DATABASE_URL: "x", AUTH_SECRET: "x", CONTRACT_CBTOKEN: "0x" + "aa".repeat(20), CONTRACT_FIXED_INCOME_TOKEN: "0x" + "bb".repeat(20) } }));

import { POST } from "@/app/api/dlt/assets/route";

function req(body: unknown, key = "k1") {
  return new Request("http://x/api/dlt/assets", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) });
}

describe("POST /api/dlt/assets", () => {
  beforeEach(() => { vi.clearAllMocks(); created.length = 0; });
  it("422 on missing bond fields", async () => {
    expect((await POST(req({ assetType: "SBN", name: "x", symbol: "x" }))).status).toBe(422);
  });
  it("creates a cash instrument (CBDC) without on-chain bond create", async () => {
    const res = await POST(req({ assetType: "CBDC", name: "wIDR", symbol: "wIDR", decimals: 18 }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.instrument.assetType).toBe("CBDC");
    expect(body.instrument.bondId ?? null).toBeNull();
  });
  it("creates a bond instrument with a bondId from the orchestration", async () => {
    const res = await POST(req({ assetType: "SBN", name: "FR0100", symbol: "FR0100", maturityDate: 1893456000, couponRateBps: 600, principalAmount: 1000000000, finalRedemptionPct: 10000 }, "k2"));
    expect(res.status).toBe(201);
    expect((await res.json()).instrument.bondId).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
