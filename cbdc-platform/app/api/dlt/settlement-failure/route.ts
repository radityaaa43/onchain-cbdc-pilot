import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { settlementFailure } from "@/lib/dlt/domains/settlementFailure";
import { AuthError } from "@/lib/auth/session";

const B32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

const ReportBody       = z.object({ action: z.literal("report"),          settlementId: B32, reason: z.number().int().min(0).max(3), details: z.string() });
const SettlIdBody      = z.object({ action: z.enum(["retry", "escalate", "buy-in-initiate"]), settlementId: B32 });
const BuyInExecuteBody = z.object({ action: z.literal("buy-in-execute"),   settlementId: B32, buyInAmount: z.number().positive(), buyInPriceBps: z.number().positive() });
const Body = z.discriminatedUnion("action", [ReportBody, SettlIdBody, BuyInExecuteBody]);

export async function POST(req: Request) {
  try {
    const user = await requirePermission("settlement.manage");
    const key = req.headers.get("idempotency-key");
    if (!key) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const d = parsed.data;
    let fn: () => Promise<unknown>;
    if      (d.action === "report")           fn = () => settlementFailure.report({ settlementId: d.settlementId, reason: d.reason, details: d.details });
    else if (d.action === "retry")            fn = () => settlementFailure.retry(d.settlementId);
    else if (d.action === "escalate")         fn = () => settlementFailure.escalate(d.settlementId);
    else if (d.action === "buy-in-initiate")  fn = () => settlementFailure.buyInInitiate(d.settlementId);
    else if (d.action === "buy-in-execute")   fn = () => settlementFailure.buyInExecute({ settlementId: d.settlementId, buyInAmount: d.buyInAmount, buyInPriceBps: d.buyInPriceBps });
    else                                      fn = () => Promise.resolve();
    const { operationId } = await startOperation(
      { userId: user.userId, orgId: user.orgId, action: `settlement-failure.${d.action}`, idempotencyKey: key, request: d },
      () => fn().then((r) => ({ result: r })),
    );
    return NextResponse.json({ operationId }, { status: 202 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    await requirePermission("settlement.view");
    const { searchParams } = new URL(req.url);
    const settlementId = searchParams.get("settlementId") ?? "";
    if (!settlementId) return NextResponse.json({ error: "settlementId required" }, { status: 400 });
    const type = searchParams.get("type");
    if (type === "buy-in") return NextResponse.json(await settlementFailure.getBuyIn(settlementId));
    return NextResponse.json(await settlementFailure.get(settlementId));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
