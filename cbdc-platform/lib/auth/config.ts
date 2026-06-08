import "server-only";
import NextAuth, { type User } from "next-auth";
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
        } as User;
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) Object.assign(token, {
        userId: user.id, orgId: user.orgId, orgType: user.orgType,
        orgAddress: user.orgAddress, roles: user.roles,
      });
      return token;
    },
    session: ({ session, token }) => {
      session.user = {
        id: token.userId,
        orgId: token.orgId,
        orgType: token.orgType,
        orgAddress: token.orgAddress,
        roles: token.roles,
        email: session.user.email,
        name: session.user.name,
        emailVerified: session.user.emailVerified ?? null,
      };
      return session;
    },
  },
});
