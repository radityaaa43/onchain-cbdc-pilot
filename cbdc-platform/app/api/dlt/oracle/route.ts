import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { oracle } from "@/lib/dlt/domains/oracle";
import { AuthError } from "@/lib/auth/session";

const B32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

const SetRateBody     = z.object({ action: z.literal("set-rate"),     bondId: B32, rate: z.number().nonnegative() });
const SetPriceBody    = z.object({ action: z.literal("set-price"),    bondId: B32, price: z.number().positive() });
const CreditEventBody = z.object({ action: z.literal("credit-event"), bondId: B32, eventType: B32, timestamp: z.number().positive() });
const Body = z.discriminatedUnion("action", [SetRateBody, SetPriceBody, CreditEventBody]);

export async function POST(req: Request) {
  try {
    const user = await requirePermission("oracle.manage");
    const key = req.headers.get("idempotency-key");
    if (!key) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const d = parsed.data;
    let fn: () => Promise<unknown>;
    if      (d.action === "set-rate")     fn = () => oracle.setRate({ bondId: d.bondId, rate: d.rate });
    else if (d.action === "set-price")    fn = () => oracle.setPrice({ bondId: d.bondId, price: d.price });
    else                                  fn = () => oracle.creditEvent({ bondId: d.bondId, eventType: d.eventType, timestamp: d.timestamp });
    const { operationId } = await startOperation(
      { userId: user.userId, orgId: user.orgId, action: `oracle.${d.action}`, idempotencyKey: key, request: d },
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
    await requirePermission("oracle.manage");
    const { searchParams } = new URL(req.url);
    const type   = searchParams.get("type") ?? "";
    const bondId = searchParams.get("bondId") ?? "";
    if (!bondId) return NextResponse.json({ error: "bondId required" }, { status: 400 });
    if (type === "rate")  return NextResponse.json(await oracle.getRate(bondId));
    if (type === "price") return NextResponse.json(await oracle.getPrice(bondId));
    if (type === "credit-event") {
      const eventType = searchParams.get("eventType") ?? "";
      if (!eventType) return NextResponse.json({ error: "eventType required" }, { status: 400 });
      return NextResponse.json(await oracle.getCreditEvent(bondId, eventType));
    }
    return NextResponse.json({ error: "type must be rate, price, or credit-event" }, { status: 400 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
