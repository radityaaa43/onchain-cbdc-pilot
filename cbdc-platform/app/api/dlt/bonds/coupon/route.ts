import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { coupon } from "@/lib/dlt/domains/coupon";
import { AuthError } from "@/lib/auth/session";

const BondId = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pay"), bondId: BondId, recipient: z.string().regex(/^0x[0-9a-fA-F]{40}$/) }),
  z.object({ action: z.literal("pay-batch"), bondId: BondId }),
  z.object({ action: z.literal("set-rate"), bondId: BondId, rateBps: z.number().int().nonnegative() }),
]);

export async function POST(req: Request) {
  try {
    const user = await requirePermission("lifecycle.coupon.pay");
    const idempotencyKey = req.headers.get("idempotency-key");
    if (!idempotencyKey) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const d = parsed.data;
    const exec = () => {
      if (d.action === "pay") return coupon.pay({ bondId: d.bondId, recipient: d.recipient });
      if (d.action === "pay-batch") return coupon.payBatch({ bondId: d.bondId });
      return coupon.setRate({ bondId: d.bondId, rateBps: d.rateBps });
    };
    const { operationId } = await startOperation(
      { userId: user.userId, orgId: user.orgId, action: `bond.coupon.${d.action}`, idempotencyKey, request: d },
      () => exec().then((r) => ({ result: r })),
    );
    return NextResponse.json({ operationId }, { status: 202 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
