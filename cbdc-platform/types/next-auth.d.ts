import type { Role } from "@prisma/client";
declare module "next-auth" {
  interface Session {
    user: { id: string; orgId: string; orgType: string; orgAddress: string; roles: Role[]; email: string; name: string };
  }
}
declare module "next-auth/jwt" {
  interface JWT { userId: string; orgId: string; orgType: string; orgAddress: string; roles: Role[]; }
}
