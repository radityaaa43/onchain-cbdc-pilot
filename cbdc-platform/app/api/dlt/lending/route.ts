import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { lending } from "@/lib/dlt/domains/lending";
import { AuthError } from "@/lib/auth/session";

const Addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const B32  = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

const InitiateBody = z.object({
  action: z.literal("initiate"),
  bondId: B32, lender: Addr, borrower: Addr,
  amount: z.number().positive(), feeRateBps: z.number().nonnegative(), tenor: z.number().positive(),
});
const InitiateHaircutBody = z.object({
  action: z.literal("initiate-with-haircut"),
  bondId: B32, lender: Addr, borrower: Addr,
  amount: z.number().positive(), feeRateBps: z.number().nonnegative(), tenor: z.number().positive(),
  haircut: z.number().nonnegative(),
});
const LendIdBody = z.object({ action: z.enum(["return", "recall", "default"]), lendId: B32 });
const Body = z.discriminatedUnion("action", [InitiateBody, InitiateHaircutBody, LendIdBody]);

export async function POST(req: Request) {
  try {
    const user = await requirePermission("lending.trade");
    const key = req.headers.get("idempotency-key");
    if (!key) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const d = parsed.data;
    let fn: () => Promise<unknown>;
    if (d.action === "initiate")               fn = () => lending.initiate({ bondId: d.bondId, lender: d.lender, borrower: d.borrower, amount: d.amount, feeRateBps: d.feeRateBps, tenor: d.tenor });
    else if (d.action === "initiate-with-haircut") fn = () => lending.initiateWithHaircut({ bondId: d.bondId, lender: d.lender, borrower: d.borrower, amount: d.amount, feeRateBps: d.feeRateBps, tenor: d.tenor, haircut: d.haircut });
    else if (d.action === "return")            fn = () => lending.return(d.lendId);
    else if (d.action === "recall")            fn = () => lending.recall(d.lendId);
    else                                       fn = () => lending.default(d.lendId);
    const { operationId } = await startOperation(
      { userId: user.userId, orgId: user.orgId, action: `lending.${d.action}`, idempotencyKey: key, request: d },
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
    await requirePermission("lending.view");
    const lendId = new URL(req.url).searchParams.get("lendId") ?? "";
    if (!lendId) return NextResponse.json({ error: "lendId required" }, { status: 400 });
    return NextResponse.json(await lending.get(lendId));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
