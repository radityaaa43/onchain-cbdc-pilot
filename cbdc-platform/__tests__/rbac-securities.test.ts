import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn(), AuthError: class AuthError extends Error { httpStatus: number; constructor(msg: string, status = 401) { super(msg); this.httpStatus = status; } } }));

import { can } from "@/lib/rbac";

describe("repo permissions", () => {
  it("TRADER can repo.view and repo.trade", () => {
    expect(can(["TRADER"], "repo.view")).toBe(true);
    expect(can(["TRADER"], "repo.trade")).toBe(true);
  });
  it("COMPLIANCE_VIEWER cannot repo.trade", () => {
    expect(can(["COMPLIANCE_VIEWER"], "repo.trade")).toBe(false);
  });
  it("OPS can repo.view but not repo.trade", () => {
    expect(can(["OPS"], "repo.view")).toBe(true);
    expect(can(["OPS"], "repo.trade")).toBe(false);
  });
});

describe("lending permissions", () => {
  it("TRADER can lending.view and lending.trade", () => {
    expect(can(["TRADER"], "lending.view")).toBe(true);
    expect(can(["TRADER"], "lending.trade")).toBe(true);
  });
});

describe("pledge permissions", () => {
  it("TRADER can pledge.view and pledge.manage", () => {
    expect(can(["TRADER"], "pledge.view")).toBe(true);
    expect(can(["TRADER"], "pledge.manage")).toBe(true);
  });
  it("OPS can pledge.view but not pledge.manage", () => {
    expect(can(["OPS"], "pledge.view")).toBe(true);
    expect(can(["OPS"], "pledge.manage")).toBe(false);
  });
});

describe("custody permissions", () => {
  it("ISSUANCE_OFFICER can custody.view and custody.manage", () => {
    expect(can(["ISSUANCE_OFFICER"], "custody.view")).toBe(true);
    expect(can(["ISSUANCE_OFFICER"], "custody.manage")).toBe(true);
  });
  it("OPS can custody.view but not custody.manage", () => {
    expect(can(["OPS"], "custody.view")).toBe(true);
    expect(can(["OPS"], "custody.manage")).toBe(false);
  });
});
