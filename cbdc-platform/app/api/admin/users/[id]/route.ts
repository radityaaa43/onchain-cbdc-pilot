import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth/session";

const Body = z.object({ status: z.enum(["ACTIVE", "DISABLED"]).optional(), roles: z.array(z.string()).optional() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("user.manage");
    const { id } = await params;
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    if (parsed.data.status) await db.user.update({ where: { id }, data: { status: parsed.data.status } });
    if (parsed.data.roles) {
      await db.userRole.deleteMany({ where: { userId: id } });
      await db.userRole.createMany({ data: parsed.data.roles.map((role) => ({ userId: id, role: role as any })) });
    }
    const user = await db.user.findUnique({ where: { id }, include: { roles: true } });
    return NextResponse.json({ user });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
