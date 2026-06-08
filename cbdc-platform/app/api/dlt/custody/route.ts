import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { custody } from "@/lib/dlt/domains/custody";
import { AuthError } from "@/lib/auth/session";

const Addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const B32  = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

const RegisterBody = z.object({ action: z.literal("register-custodian"), custodian: Addr });
const SetOwnerBody = z.object({
  action: z.literal("set-beneficial-owner"),
  bondId: B32, custodian: Addr, subAccountId: z.string(), owner: Addr,
});
const Body = z.discriminatedUnion("action", [RegisterBody, SetOwnerBody]);

export async function POST(req: Request) {
  try {
    const user = await requirePermission("custody.manage");
    const key = req.headers.get("idempotency-key");
    if (!key) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const d = parsed.data;
    let fn: () => Promise<unknown>;
    if (d.action === "register-custodian")    fn = () => custody.registerCustodian(d.custodian);
    else                                       fn = () => custody.setBeneficialOwner({ bondId: d.bondId, custodian: d.custodian, subAccountId: d.subAccountId, owner: d.owner });
    const { operationId } = await startOperation(
      { userId: user.userId, orgId: user.orgId, action: `custody.${d.action}`, idempotencyKey: key, request: d },
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
    await requirePermission("custody.view");
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? "";

    if (type === "holdings") {
      const custodian = searchParams.get("custodian") ?? "";
      const bondId = searchParams.get("bondId") ?? "";
      if (!custodian || !bondId) return NextResponse.json({ error: "custodian and bondId required" }, { status: 400 });
      return NextResponse.json(await custody.getHoldings({ custodian, bondId }));
    } else if (type === "beneficial-owner") {
      const bondId = searchParams.get("bondId") ?? "";
      const custodian = searchParams.get("custodian") ?? "";
      const subAccountId = searchParams.get("subAccountId") ?? "";
      if (!bondId || !custodian || !subAccountId) return NextResponse.json({ error: "bondId, custodian, and subAccountId required" }, { status: 400 });
      return NextResponse.json(await custody.getBeneficialOwner({ bondId, custodian, subAccountId }));
    } else {
      return NextResponse.json({ error: "type must be holdings or beneficial-owner" }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
