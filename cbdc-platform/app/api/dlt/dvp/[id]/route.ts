import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { dvp } from "@/lib/dlt/domains/dvp";
import { AuthError } from "@/lib/auth/session";

const Body = z.object({ action: z.enum(["fail", "cancel"]), reason: z.string().min(1) });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("dvp.view");
    const { id } = await params;
    return NextResponse.json(await dvp.status(id));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 502 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("dvp.initiate");
    const idempotencyKey = req.headers.get("idempotency-key");
    if (!idempotencyKey) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const { id } = await params;
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const { operationId } = await startOperation(
      { userId: user.userId, orgId: user.orgId, action: `dvp.${parsed.data.action}`, idempotencyKey, request: { id, ...parsed.data } },
      () => (parsed.data.action === "fail" ? dvp.fail(id, { reason: parsed.data.reason }) : dvp.cancel(id, { reason: parsed.data.reason })).then((r) => ({ result: r })),
    );
    return NextResponse.json({ operationId }, { status: 202 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
