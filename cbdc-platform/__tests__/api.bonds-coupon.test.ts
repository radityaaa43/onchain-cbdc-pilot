import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn(), AuthError: class AuthError extends Error { httpStatus: number; constructor(msg: string, status = 401) { super(msg); this.httpStatus = status; } } }));
vi.mock("@/lib/rbac", () => ({ requirePermission: vi.fn(async () => ({ userId: "u1", orgId: "o1", roles: ["ISSUANCE_OFFICER"] })) }));
const started: any[] = [];
vi.mock("@/lib/operations", () => ({ startOperation: vi.fn(async (c: any) => { started.push(c.action); return { operationId: "op-1" }; }) }));
vi.mock("@/lib/dlt/domains/coupon", () => ({ coupon: { pay: vi.fn(), payBatch: vi.fn(), setRate: vi.fn() } }));

import { POST } from "@/app/api/dlt/bonds/coupon/route";
const BOND = "0x" + "11".repeat(32);
const req = (b: unknown, key = "k1") => new Request("http://x", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(b) });

describe("POST /api/dlt/bonds/coupon", () => {
  beforeEach(() => { vi.clearAllMocks(); started.length = 0; });
  it("422 on bad action", async () => expect((await POST(req({ action: "nope", bondId: BOND }))).status).toBe(422));
  it("pays a batch coupon", async () => { expect((await POST(req({ action: "pay-batch", bondId: BOND }))).status).toBe(202); expect(started[0]).toBe("bond.coupon.pay-batch"); });
  it("sets a coupon rate", async () => { expect((await POST(req({ action: "set-rate", bondId: BOND, rateBps: 600 }, "k2"))).status).toBe(202); expect(started[0]).toBe("bond.coupon.set-rate"); });
});
