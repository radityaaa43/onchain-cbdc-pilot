import { NextResponse } from "next/server";
import { z } from "zod";
import argon2 from "argon2";
import { requirePermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth/session";

const ROLES = ["OPERATOR_ADMIN","ISSUANCE_OFFICER","COMPLIANCE_OFFICER","PARTICIPANT_ADMIN","TRADER","OPS","COMPLIANCE_VIEWER"] as const;
const Body = z.object({ email: z.string().email(), name: z.string().min(1), password: z.string().min(8), orgId: z.string().min(1), roles: z.array(z.enum(ROLES)).min(1) });

export async function GET() {
  try {
    await requirePermission("user.manage");
    const list = await db.user.findMany({ include: { org: true, roles: true }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ users: list });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requirePermission("user.manage");
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const passwordHash = await argon2.hash(parsed.data.password);
    const user = await db.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        orgId: parsed.data.orgId,
        passwordHash,
        roles: { create: parsed.data.roles.map((role) => ({ role })) },
      },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
