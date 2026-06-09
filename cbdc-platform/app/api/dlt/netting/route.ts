import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { netting } from "@/lib/dlt/domains/netting";
import { AuthError } from "@/lib/auth/session";

const Addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const B32  = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

const OpenSessionBody = z.object({ action: z.literal("open-session") });
const AddEntryBody    = z.object({ action: z.literal("add-entry"), sessionId: B32, from: Addr, to: Addr, amount: z.number().positive() });
const SessionIdBody   = z.object({ action: z.enum(["settle", "cancel"]), sessionId: B32 });
const Body = z.discriminatedUnion("action", [OpenSessionBody, AddEntryBody, SessionIdBody]);

export async function POST(req: Request) {
  try {
    const user = await requirePermission("netting.manage");
    const key = req.headers.get("idempotency-key");
    if (!key) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const d = parsed.data;
    let fn: () => Promise<unknown>;
    if      (d.action === "open-session") fn = () => netting.openSession();
    else if (d.action === "add-entry")    fn = () => netting.addEntry({ sessionId: d.sessionId, from: d.from, to: d.to, amount: d.amount });
    else if (d.action === "settle")       fn = () => netting.settle(d.sessionId);
    else                                  fn = () => netting.cancel(d.sessionId);
    const { operationId } = await startOperation(
      { userId: user.userId, orgId: user.orgId, action: `netting.${d.action}`, idempotencyKey: key, request: d },
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
    await requirePermission("netting.manage");
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId") ?? "";
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    const type = searchParams.get("type");
    if (type === "entries") return NextResponse.json(await netting.getEntries(sessionId));
    return NextResponse.json(await netting.getSession(sessionId));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
