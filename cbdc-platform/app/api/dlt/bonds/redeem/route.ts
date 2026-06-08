import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { bondOps } from "@/lib/dlt/domains/bondOps";
import { AuthError } from "@/lib/auth/session";

const Body = z.object({ bondId: z.string().regex(/^0x[0-9a-fA-F]{64}$/), holder: z.string().regex(/^0x[0-9a-fA-F]{40}$/), amount: z.number().int().positive() });

export async function POST(req: Request) {
  try {
    const user = await requirePermission("bond.redeem");
    const idempotencyKey = req.headers.get("idempotency-key");
    if (!idempotencyKey) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const { operationId } = await startOperation(
      { userId: user.userId, orgId: user.orgId, action: "bond.redeem", idempotencyKey, request: parsed.data },
      () => bondOps.redeem(parsed.data).then((r) => ({ result: r })),
    );
    return NextResponse.json({ operationId }, { status: 202 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
