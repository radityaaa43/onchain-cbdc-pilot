import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { pledge } from "@/lib/dlt/domains/pledge";
import { AuthError } from "@/lib/auth/session";

const Addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const B32  = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

const CreateBody = z.object({
  action: z.literal("create"),
  bondId: B32, pledgor: Addr, pledgee: Addr,
  amount: z.number().positive(), expiryDate: z.number().positive(),
});
const PledgeIdBody = z.object({ action: z.enum(["release", "enforce"]), pledgeId: B32 });
const Body = z.discriminatedUnion("action", [CreateBody, PledgeIdBody]);

export async function POST(req: Request) {
  try {
    const user = await requirePermission("pledge.manage");
    const key = req.headers.get("idempotency-key");
    if (!key) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const d = parsed.data;
    let fn: () => Promise<unknown>;
    if (d.action === "create")        fn = () => pledge.create({ bondId: d.bondId, pledgor: d.pledgor, pledgee: d.pledgee, amount: d.amount, expiryDate: d.expiryDate });
    else if (d.action === "release")  fn = () => pledge.release(d.pledgeId);
    else                              fn = () => pledge.enforce(d.pledgeId);
    const { operationId } = await startOperation(
      { userId: user.userId, orgId: user.orgId, action: `pledge.${d.action}`, idempotencyKey: key, request: d },
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
    await requirePermission("pledge.view");
    const pledgeId = new URL(req.url).searchParams.get("pledgeId") ?? "";
    if (!pledgeId) return NextResponse.json({ error: "pledgeId required" }, { status: 400 });
    return NextResponse.json(await pledge.get(pledgeId));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
