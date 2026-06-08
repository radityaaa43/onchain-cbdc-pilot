import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { maturity } from "@/lib/dlt/domains/maturity";
import { bondOps } from "@/lib/dlt/domains/bondOps";
import { AuthError } from "@/lib/auth/session";

const BondId = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set-info"), bondId: BondId, maturityDate: z.number().int().positive(), finalRedemptionPct: z.number().int().min(0).max(10000), principalAmount: z.number().int().positive() }),
  z.object({ action: z.literal("trigger"), bondId: BondId }),
  z.object({ action: z.literal("track"), bondId: BondId }),
  z.object({ action: z.literal("trigger-batch") }),
]);

export async function POST(req: Request) {
  try {
    const user = await requirePermission("lifecycle.maturity.trigger");
    const idempotencyKey = req.headers.get("idempotency-key");
    if (!idempotencyKey) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const d = parsed.data;
    const exec = () => {
      if (d.action === "set-info") return maturity.setInfo(d);
      if (d.action === "trigger") return maturity.trigger({ bondId: d.bondId });
      if (d.action === "track") return bondOps.trackMaturity({ bondId: d.bondId });
      return bondOps.triggerMaturityBatch();
    };
    const { operationId } = await startOperation(
      { userId: user.userId, orgId: user.orgId, action: `bond.maturity.${d.action}`, idempotencyKey, request: d },
      () => exec().then((r) => ({ result: r })),
    );
    return NextResponse.json({ operationId }, { status: 202 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
