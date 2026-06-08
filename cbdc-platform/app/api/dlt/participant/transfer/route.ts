import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { cbdc } from "@/lib/dlt/domains/cbdc";
import { AuthError } from "@/lib/auth/session";

const Body = z.object({ to: z.string().regex(/^0x[0-9a-fA-F]{40}$/), amount: z.number().int().positive() });

export async function POST(req: Request) {
  try {
    const user = await requirePermission("cbdc.transfer");
    const idempotencyKey = req.headers.get("idempotency-key");
    if (!idempotencyKey) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const payload = { from: user.orgAddress, to: parsed.data.to, amount: parsed.data.amount };
    const { operationId } = await startOperation(
      { userId: user.userId, orgId: user.orgId, action: "cbdc.transfer", idempotencyKey, request: payload },
      () => cbdc.transfer(payload).then((r) => ({ result: r })),
    );
    return NextResponse.json({ operationId }, { status: 202 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
