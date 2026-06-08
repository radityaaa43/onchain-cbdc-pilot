import type { Role } from "@prisma/client";
import { getSession, AuthError } from "@/lib/auth/session";

export type Permission =
  | "cbdc.view" | "cbdc.transfer" | "cbdc.redeem.request" | "cbdc.issue" | "cbdc.redeem.process"
  | "bond.view" | "bond.transfer" | "bond.register" | "bond.issue" | "bond.redeem"
  | "lifecycle.view" | "lifecycle.coupon.pay" | "lifecycle.maturity.trigger"
  | "dvp.view" | "dvp.initiate" | "dvp.affirm"
  | "asset.create" | "asset.release"
  | "auction.view" | "auction.create" | "auction.allocate" | "auction.settle"
  | "compliance.view" | "compliance.manage"
  | "user.manage" | "org.manage" | "audit.view";

const GRANTS: Record<Role, Permission[]> = {
  OPERATOR_ADMIN: [
    "cbdc.issue", "cbdc.redeem.process", "cbdc.transfer", "cbdc.redeem.request",
    "bond.register", "bond.issue", "bond.redeem", "bond.transfer",
    "lifecycle.coupon.pay", "lifecycle.maturity.trigger",
    "dvp.initiate", "dvp.affirm",
    "asset.create", "asset.release",
    "auction.create", "auction.allocate", "auction.settle",
    "compliance.manage", "user.manage", "org.manage", "audit.view",
  ],
  ISSUANCE_OFFICER: [
    "cbdc.issue", "cbdc.redeem.process",
    "bond.register", "bond.issue", "bond.redeem",
    "lifecycle.coupon.pay", "lifecycle.maturity.trigger",
    "dvp.initiate",
    "asset.create", "asset.release",
    "auction.create", "auction.allocate", "auction.settle",
  ],
  COMPLIANCE_OFFICER: ["compliance.manage", "audit.view"],
  PARTICIPANT_ADMIN: ["user.manage", "audit.view"],
  TRADER: ["cbdc.transfer", "bond.transfer", "dvp.initiate", "dvp.affirm"],
  OPS: ["cbdc.redeem.request", "dvp.affirm"],
  COMPLIANCE_VIEWER: ["compliance.view", "audit.view"],
};

export function can(roles: Role[], perm: Permission): boolean {
  if (perm.endsWith(".view")) return true;
  return roles.some((r) => GRANTS[r]?.includes(perm));
}

export async function requirePermission(perm: Permission) {
  const u = await getSession();
  if (!can(u.roles, perm)) throw new AuthError(`Forbidden: ${perm}`, 403);
  return { userId: u.id, orgId: u.orgId, orgAddress: u.orgAddress, roles: u.roles };
}
