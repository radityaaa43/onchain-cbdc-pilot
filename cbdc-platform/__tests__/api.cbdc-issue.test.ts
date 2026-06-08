import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/rbac", () => ({
  requirePermission: vi.fn(async () => ({
    userId: "u1",
    orgId: "o1",
    orgAddress: "0x0000000000000000000000000000000000000001",
    roles: ["ISSUANCE_OFFICER"],
  })),
}));
vi.mock("@/lib/operations", () => ({
  startOperation: vi.fn(async () => ({ operationId: "op-1" })),
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public httpStatus: number) { super(message); }
  },
}));
vi.mock("@/lib/dlt/domains/cbdc", () => ({
  cbdc: { balance: vi.fn(), issuedTotal: vi.fn(), issue: vi.fn(), transfer: vi.fn() },
}));

import { POST } from "@/app/api/dlt/cbdc/issue/route";
import { startOperation } from "@/lib/operations";

function makeReq(body: unknown, idempotencyKey = "idem-1") {
  return new Request("http://localhost/api/dlt/cbdc/issue", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
    body: JSON.stringify(body),
  });
}

describe("POST /api/dlt/cbdc/issue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 422 on invalid body (negative amount)", async () => {
    const res = await POST(makeReq({ to: "0x0000000000000000000000000000000000000002", amount: -1 }));
    expect(res.status).toBe(422);
  });

  it("returns 202 with operationId on valid body", async () => {
    const res = await POST(makeReq({ to: "0x0000000000000000000000000000000000000002", amount: 1000 }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.operationId).toBe("op-1");
    expect(startOperation).toHaveBeenCalledOnce();
  });

  it("returns 400 when Idempotency-Key header missing", async () => {
    const r = new Request("http://localhost/api/dlt/cbdc/issue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: "0x0000000000000000000000000000000000000002", amount: 10 }),
    });
    const res = await POST(r);
    expect(res.status).toBe(400);
  });
});
