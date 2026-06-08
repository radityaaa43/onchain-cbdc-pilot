import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { z } from "zod";
import { db } from "@/lib/db";

const Login = z.object({ email: z.string().email(), password: z.string().min(1) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (raw) => {
        const parsed = Login.safeParse(raw);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({ where: { email: parsed.data.email }, include: { org: true, roles: true } });
        if (!user || user.status !== "ACTIVE") return null;
        if (!(await argon2.verify(user.passwordHash, parsed.data.password))) return null;
        return {
          id: user.id, email: user.email, name: user.name,
          orgId: user.orgId, orgType: user.org.type, orgAddress: user.org.onchainAddress,
          roles: user.roles.map((r) => r.role),
        } as any;
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) Object.assign(token, {
        userId: (user as any).id, orgId: (user as any).orgId, orgType: (user as any).orgType,
        orgAddress: (user as any).orgAddress, roles: (user as any).roles,
      });
      return token;
    },
    session: ({ session, token }) => {
      session.user = {
        id: token.userId as string,
        orgId: token.orgId as string,
        orgType: token.orgType as string,
        orgAddress: token.orgAddress as string,
        roles: token.roles as any[],
        email: session.user.email,
        name: session.user.name,
      } as any;
      return session;
    },
  },
});
