import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn(), AuthError: class AuthError extends Error { httpStatus: number; constructor(msg: string, status = 401) { super(msg); this.httpStatus = status; } } }));
vi.mock("@/lib/rbac", () => ({ requirePermission: vi.fn(async () => ({ userId: "u1", orgId: "o1", roles: ["ISSUANCE_OFFICER"] })) }));
const started: any[] = [];
vi.mock("@/lib/operations", () => ({ startOperation: vi.fn(async (c: any) => { started.push(c.action); return { operationId: "op-1" }; }) }));
vi.mock("@/lib/dlt/domains/bondMetadata", () => ({ bondMetadata: { setStatic: vi.fn(), setTerms: vi.fn(), setDltPlatform: vi.fn(), setCreditEvents: vi.fn(), setRatings: vi.fn(), setIndonesian: vi.fn() } }));

import { POST } from "@/app/api/dlt/bonds/metadata/route";
const req = (b: unknown, key = "k1") => new Request("http://x", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(b) });

describe("POST /api/dlt/bonds/metadata", () => {
  beforeEach(() => { vi.clearAllMocks(); started.length = 0; });
  it("422 on unknown group", async () => expect((await POST(req({ group: "nope", data: {} }))).status).toBe(422));
  it("sets the terms group", async () => { expect((await POST(req({ group: "terms", data: { interestRateBps: 600 } }))).status).toBe(202); expect(started[0]).toBe("bond.metadata.terms"); });
  it("sets the indonesian-market group", async () => { expect((await POST(req({ group: "indonesian", data: { ksei: "x" } }, "k2"))).status).toBe(202); expect(started[0]).toBe("bond.metadata.indonesian"); });
});
