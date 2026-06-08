import type { Role } from "@prisma/client";
import { getSession, AuthError } from "@/lib/auth/session";

export type Permission =
  | "cbdc.view" | "cbdc.transfer" | "cbdc.approve" | "cbdc.redeem.request" | "cbdc.issue" | "cbdc.redeem.process"
  | "bond.view" | "bond.transfer" | "bond.register" | "bond.issue" | "bond.redeem"
  | "lifecycle.view" | "lifecycle.coupon.pay" | "lifecycle.maturity.trigger"
  | "dvp.view" | "dvp.initiate" | "dvp.affirm"
  | "asset.create" | "asset.release"
  | "auction.view" | "auction.create" | "auction.allocate" | "auction.settle"
  | "compliance.view" | "compliance.manage"
  | "user.manage" | "org.manage" | "audit.view";

const GRANTS: Record<Role, Permission[]> = {
  OPERATOR_ADMIN: [
    "cbdc.view", "cbdc.issue", "cbdc.redeem.process", "cbdc.transfer", "cbdc.approve", "cbdc.redeem.request",
    "bond.view", "bond.register", "bond.issue", "bond.redeem", "bond.transfer",
    "lifecycle.view", "lifecycle.coupon.pay", "lifecycle.maturity.trigger",
    "dvp.view", "dvp.initiate", "dvp.affirm",
    "asset.create", "asset.release",
    "auction.view", "auction.create", "auction.allocate", "auction.settle",
    "compliance.view", "compliance.manage", "user.manage", "org.manage", "audit.view",
  ],
  ISSUANCE_OFFICER: [
    "cbdc.view", "cbdc.issue", "cbdc.redeem.process",
    "bond.view", "bond.register", "bond.issue", "bond.redeem",
    "lifecycle.view", "lifecycle.coupon.pay", "lifecycle.maturity.trigger",
    "dvp.view", "dvp.initiate",
    "asset.create", "asset.release",
    "auction.view", "auction.create", "auction.allocate", "auction.settle",
  ],
  COMPLIANCE_OFFICER: ["compliance.view", "compliance.manage", "audit.view"],
  PARTICIPANT_ADMIN: ["user.manage", "audit.view"],
  TRADER: ["cbdc.view", "cbdc.transfer", "cbdc.approve", "bond.view", "bond.transfer", "dvp.view", "dvp.initiate", "dvp.affirm"],
  OPS: ["cbdc.view", "cbdc.redeem.request", "dvp.view", "dvp.affirm"],
  COMPLIANCE_VIEWER: ["compliance.view", "audit.view"],
};

export function can(roles: Role[], perm: Permission): boolean {
  return roles.some((r) => GRANTS[r]?.includes(perm));
}

export async function requirePermission(perm: Permission) {
  const u = await getSession();
  if (!can(u.roles, perm)) throw new AuthError(`Forbidden: ${perm}`, 403);
  return { userId: u.id, orgId: u.orgId, orgAddress: u.orgAddress, roles: u.roles };
}
