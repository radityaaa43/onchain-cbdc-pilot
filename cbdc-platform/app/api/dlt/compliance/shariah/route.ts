import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { shariah } from "@/lib/dlt/domains/shariah";
import { AuthError } from "@/lib/auth/session";

const Addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const B32  = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

const ApproveSukukBody  = z.object({ action: z.literal("approve-sukuk"), bondId: B32, shariahBoard: Addr });
const CertifyProfitBody = z.object({ action: z.literal("certify-profit"), bondId: B32, totalProfit: z.number().positive(), investorShare: z.number().positive() });
const EventBody         = z.object({ action: z.literal("event"), bondId: B32, eventType: z.string().min(1) });
const Body = z.discriminatedUnion("action", [ApproveSukukBody, CertifyProfitBody, EventBody]);

export async function POST(req: Request) {
  try {
    const user = await requirePermission("compliance.manage");
    const key = req.headers.get("idempotency-key");
    if (!key) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const d = parsed.data;
    let fn: () => Promise<unknown>;
    if (d.action === "approve-sukuk") fn = () => shariah.approveSukuk({ bondId: d.bondId, shariahBoard: d.shariahBoard });
    else if (d.action === "certify-profit") fn = () => shariah.certifyProfit({ bondId: d.bondId, totalProfit: d.totalProfit, investorShare: d.investorShare });
    else fn = () => shariah.reportEvent({ bondId: d.bondId, eventType: d.eventType });
    const { operationId } = await startOperation(
      { userId: user.userId, orgId: user.orgId, action: `compliance.shariah.${d.action}`, idempotencyKey: key, request: d },
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
    await requirePermission("compliance.view");
    const { searchParams } = new URL(req.url);
    const bondId = searchParams.get("bondId") ?? "";
    if (!bondId) return NextResponse.json({ error: "bondId required" }, { status: 400 });
    const type = searchParams.get("type") ?? "approval";
    if (type === "approval")            return NextResponse.json(await shariah.approval(bondId));
    if (type === "profit-distribution") return NextResponse.json(await shariah.profitDistribution(bondId));
    if (type === "events")              return NextResponse.json(await shariah.events(bondId));
    if (type === "is-approved")         return NextResponse.json(await shariah.isApproved(bondId));
    return NextResponse.json({ error: "unknown type" }, { status: 400 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
