import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// Mock auth() from config — controlled per-test via mockResolvedValue
const mockAuth = vi.fn();
vi.mock("@/lib/auth/config", () => ({
  auth: mockAuth,
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

describe("getSession", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
  });

  it("throws AuthError(401) when auth() returns null", async () => {
    mockAuth.mockResolvedValue(null);
    const { getSession, AuthError } = await import("@/lib/auth/session");
    await expect(getSession()).rejects.toBeInstanceOf(AuthError);
    await expect(getSession()).rejects.toMatchObject({ httpStatus: 401 });
  });

  it("throws AuthError(401) when session has no user", async () => {
    mockAuth.mockResolvedValue({ user: null });
    const { getSession, AuthError } = await import("@/lib/auth/session");
    await expect(getSession()).rejects.toBeInstanceOf(AuthError);
  });

  it("returns session.user when authenticated", async () => {
    const user = { id: "u1", email: "a@b.com", orgId: "org1", orgType: "CBDC_ISSUER", orgAddress: "0x1", roles: [] };
    mockAuth.mockResolvedValue({ user });
    const { getSession } = await import("@/lib/auth/session");
    const result = await getSession();
    expect(result).toBe(user);
  });
});

describe("AuthError", () => {
  it("exposes httpStatus correctly", async () => {
    const { AuthError } = await import("@/lib/auth/session");
    const err = new AuthError("Forbidden", 403);
    expect(err.httpStatus).toBe(403);
    expect(err.message).toBe("Forbidden");
    expect(err).toBeInstanceOf(Error);
  });
});
