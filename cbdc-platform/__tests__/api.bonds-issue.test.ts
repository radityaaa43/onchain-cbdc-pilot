import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn(), AuthError: class AuthError extends Error { httpStatus: number; constructor(msg: string, status = 401) { super(msg); this.httpStatus = status; } } }));
vi.mock("@/lib/rbac", () => ({ requirePermission: vi.fn(async () => ({ userId: "u1", orgId: "o1", roles: ["ISSUANCE_OFFICER"] })) }));
const started: any[] = [];
vi.mock("@/lib/operations", () => ({ startOperation: vi.fn(async (c: any) => { started.push(c.action); return { operationId: "op-1" }; }) }));
vi.mock("@/lib/dlt/domains/bonds", () => ({ bonds: { issue: vi.fn(async () => ({ ok: true })) } }));

import { POST } from "@/app/api/dlt/bonds/issue/route";
const BOND = "0x" + "11".repeat(32);
const req = (b: unknown, key = "k1") => new Request("http://x", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(b) });

describe("POST /api/dlt/bonds/issue", () => {
  beforeEach(() => { vi.clearAllMocks(); started.length = 0; });
  it("422 on bad bondId", async () => expect((await POST(req({ bondId: "x", investor: "0x" + "02".repeat(20), amount: 1 }))).status).toBe(422));
  it("202 direct issue", async () => { expect((await POST(req({ bondId: BOND, investor: "0x" + "02".repeat(20), amount: 1000 }))).status).toBe(202); expect(started[0]).toBe("bond.issue"); });
});
