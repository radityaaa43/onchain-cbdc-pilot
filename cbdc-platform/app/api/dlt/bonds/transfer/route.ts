import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { bondOps } from "@/lib/dlt/domains/bondOps";
import { AuthError } from "@/lib/auth/session";

const Addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const Body = z.object({ bondId: z.string().regex(/^0x[0-9a-fA-F]{64}$/), from: Addr, to: Addr, amount: z.number().int().positive() });

export async function POST(req: Request) {
  try {
    const user = await requirePermission("bond.transfer");
    const idempotencyKey = req.headers.get("idempotency-key");
    if (!idempotencyKey) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const { operationId } = await startOperation(
      { userId: user.userId, orgId: user.orgId, action: "bond.transfer", idempotencyKey, request: parsed.data },
      () => bondOps.transfer(parsed.data).then((r) => ({ result: r })),
    );
    return NextResponse.json({ operationId }, { status: 202 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
