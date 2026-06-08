import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, AuthError } from "@/lib/auth/session";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSession();
    const { id } = await params;
    const op = await db.operation.findUnique({ where: { id } });
    if (!op || op.orgId !== user.orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ id: op.id, status: op.status, txHash: op.txHash, error: op.error, result: op.result });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
