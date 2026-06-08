import { describe, it, expect, vi, beforeEach } from "vitest";
const ORG_ADDR = "0x" + "0a".repeat(20);
vi.mock("@/lib/rbac", () => ({ requirePermission: vi.fn(async () => ({ userId: "u1", orgId: "o1", orgAddress: ORG_ADDR, roles: ["TRADER"] })) }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn(), AuthError: class AuthError extends Error { httpStatus: number; constructor(msg: string, status = 401) { super(msg); this.httpStatus = status; } } }));
const transferred: any[] = [];
vi.mock("@/lib/operations", () => ({ startOperation: vi.fn(async (_c: any, exec: any) => { await exec(); return { operationId: "op-1" }; }) }));
vi.mock("@/lib/dlt/domains/cbdc", () => ({ cbdc: { transfer: vi.fn(async (b: any) => { transferred.push(b); return { ok: true }; }) } }));

import { POST } from "@/app/api/dlt/participant/transfer/route";
const req = (b: unknown, key = "k1") => new Request("http://x", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(b) });

describe("POST /api/dlt/participant/transfer", () => {
  beforeEach(() => { vi.clearAllMocks(); transferred.length = 0; });
  it("422 on invalid recipient", async () => expect((await POST(req({ to: "x", amount: 10 }))).status).toBe(422));
  it("forces `from` to the session org address, ignoring any client-supplied from", async () => {
    const res = await POST(req({ to: "0x" + "02".repeat(20), amount: 500, from: "0x" + "ff".repeat(20) }));
    expect(res.status).toBe(202);
    expect(transferred[0].from).toBe(ORG_ADDR);
    expect(transferred[0].from).not.toBe("0x" + "ff".repeat(20));
  });
});
