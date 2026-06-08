import type { Role } from "@prisma/client";
declare module "next-auth" {
  interface User {
    orgId: string;
    orgType: string;
    orgAddress: string;
    roles: Role[];
  }
  interface Session {
    user: { id: string; orgId: string; orgType: string; orgAddress: string; roles: Role[]; email: string; name: string };
  }
}
declare module "next-auth/jwt" {
  interface JWT { userId: string; orgId: string; orgType: string; orgAddress: string; roles: Role[]; }
}
declare module "@auth/core/jwt" {
  interface JWT { userId: string; orgId: string; orgType: string; orgAddress: string; roles: Role[]; }
}
