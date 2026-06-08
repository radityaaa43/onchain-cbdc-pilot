import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public httpStatus: number) { super(message); }
  },
}));

import { can } from "@/lib/rbac";

describe("can()", () => {
  it("allows OPERATOR_ADMIN to issue cbdc", () => {
    expect(can(["OPERATOR_ADMIN"], "cbdc.issue")).toBe(true);
  });
  it("denies TRADER from issuing cbdc", () => {
    expect(can(["TRADER"], "cbdc.issue")).toBe(false);
  });
  it("allows TRADER to transfer cbdc", () => {
    expect(can(["TRADER"], "cbdc.transfer")).toBe(true);
  });
  it("grants every role view permissions", () => {
    expect(can(["COMPLIANCE_VIEWER"], "cbdc.view")).toBe(true);
  });
});
