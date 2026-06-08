import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn(), AuthError: class AuthError extends Error { httpStatus: number; constructor(msg: string, status = 401) { super(msg); this.httpStatus = status; } } }));
vi.mock("@/lib/rbac", () => ({ requirePermission: vi.fn(async () => ({ userId: "u1", orgId: "o1", roles: ["OPERATOR_ADMIN"] })) }));
const users: any[] = [];
vi.mock("@/lib/db", () => ({ db: {
  user: { findMany: vi.fn(async () => users), create: vi.fn(async ({ data }: any) => { const u = { id: "u-new", ...data }; users.push(u); return u; }) },
} }));
vi.mock("argon2", () => ({ default: { hash: vi.fn(async () => "HASH") } }));

import { POST } from "@/app/api/admin/users/route";
const req = (b: unknown) => new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });

describe("POST /api/admin/users", () => {
  beforeEach(() => { vi.clearAllMocks(); users.length = 0; });
  it("422 on invalid email", async () => expect((await POST(req({ email: "x", name: "A", password: "secret12", orgId: "o1", roles: ["TRADER"] }))).status).toBe(422));
  it("creates a user with hashed password + roles", async () => {
    const res = await POST(req({ email: "trader@bank.id", name: "Trader", password: "secret12", orgId: "o1", roles: ["TRADER"] }));
    expect(res.status).toBe(201);
    expect((await res.json()).user.passwordHash).toBe("HASH");
  });
});
