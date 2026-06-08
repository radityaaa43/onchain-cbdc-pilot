import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn(), AuthError: class AuthError extends Error { httpStatus: number; constructor(msg: string, status = 401) { super(msg); this.httpStatus = status; } } }));
vi.mock("@/lib/rbac", () => ({ requirePermission: vi.fn(async () => ({ userId: "u1", orgId: "o1", orgAddress: "0x" + "01".repeat(20), roles: ["OPERATOR_ADMIN"] })) }));
const started: any[] = [];
vi.mock("@/lib/operations", () => ({ startOperation: vi.fn(async (c: any) => { started.push(c.action); return { operationId: "op-1" }; }) }));
vi.mock("@/lib/dlt/domains/limits", () => ({ limits: { setBalance: vi.fn(), setDaily: vi.fn() } }));

import { POST } from "@/app/api/dlt/cbdc/limits/route";
const req = (b: unknown, key = "k1") => new Request("http://x", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(b) });

describe("POST /api/dlt/cbdc/limits", () => {
  beforeEach(() => { vi.clearAllMocks(); started.length = 0; });
  it("422 on invalid kind", async () => expect((await POST(req({ kind: "weird", account: "0x" + "02".repeat(20), limit: 1 }))).status).toBe(422));
  it("202 + sets a balance limit", async () => {
    expect((await POST(req({ kind: "balance", account: "0x" + "02".repeat(20), limit: 1000 }))).status).toBe(202);
    expect(started[0]).toBe("cbdc.limit.balance");
  });
  it("202 + sets a daily limit", async () => {
    expect((await POST(req({ kind: "daily", account: "0x" + "02".repeat(20), limit: 500 }, "k2"))).status).toBe(202);
    expect(started[0]).toBe("cbdc.limit.daily");
  });
});
