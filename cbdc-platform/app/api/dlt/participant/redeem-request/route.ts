import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { redemption } from "@/lib/dlt/domains/redemption";
import { AuthError } from "@/lib/auth/session";

const Body = z.object({ amount: z.number().int().positive() });

export async function POST(req: Request) {
  try {
    const u = await requirePermission("cbdc.redeem.request");
    const idempotencyKey = req.headers.get("idempotency-key");
    if (!idempotencyKey) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const payload = { user: u.orgAddress, amount: parsed.data.amount };
    const { operationId } = await startOperation(
      { userId: u.userId, orgId: u.orgId, action: "cbdc.redeem.request", idempotencyKey, request: payload },
      () => redemption.request(payload).then((r) => ({ result: r })),
    );
    return NextResponse.json({ operationId }, { status: 202 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
