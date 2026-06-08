import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { dvp } from "@/lib/dlt/domains/dvp";
import { AuthError } from "@/lib/auth/session";

const Addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const B32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const Body = z.object({
  bondId: B32, bondSeller: Addr, bondBuyer: Addr, bondAmount: z.number().int().positive(), bondPartition: B32,
  cbdcPayer: Addr, cbdcPayee: Addr, cbdcAmount: z.number().int().positive(), model: z.number().int().min(0).max(2),
});

export async function POST(req: Request) {
  try {
    const user = await requirePermission("dvp.initiate");
    const idempotencyKey = req.headers.get("idempotency-key");
    if (!idempotencyKey) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const { operationId } = await startOperation(
      { userId: user.userId, orgId: user.orgId, action: "dvp.initiate", idempotencyKey, request: parsed.data },
      () => dvp.initiate(parsed.data).then((r) => ({ result: r, txHash: undefined })),
    );
    return NextResponse.json({ operationId }, { status: 202 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
