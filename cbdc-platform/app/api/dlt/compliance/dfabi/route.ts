import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { complianceDfabi } from "@/lib/dlt/domains/complianceDfabi";
import { AuthError } from "@/lib/auth/session";

const Addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const B32  = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

const EligibleBody = z.object({
  action: z.literal("eligible"),
  participant: Addr,
  eligible: z.boolean(),
});
const EligibleByBondBody = z.object({
  action: z.literal("eligible-by-bond"),
  participant: Addr,
  bondId: B32,
  eligible: z.boolean(),
});
const RestrictionBody = z.object({
  action: z.literal("restriction"),
  bondId: B32,
  restriction: z.object({ minAmount: z.number().nonnegative(), maxAmount: z.number().positive() }),
});
const Body = z.discriminatedUnion("action", [EligibleBody, EligibleByBondBody, RestrictionBody]);

export async function POST(req: Request) {
  try {
    const user = await requirePermission("compliance.manage");
    const key = req.headers.get("idempotency-key");
    if (!key) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const d = parsed.data;
    let fn: () => Promise<unknown>;
    if (d.action === "eligible") fn = () => complianceDfabi.setEligible({ participant: d.participant, eligible: d.eligible });
    else if (d.action === "eligible-by-bond") fn = () => complianceDfabi.setEligibleByBond({ participant: d.participant, bondId: d.bondId, eligible: d.eligible });
    else fn = () => complianceDfabi.setRestriction({ bondId: d.bondId, restriction: d.restriction });
    const { operationId } = await startOperation(
      { userId: user.userId, orgId: user.orgId, action: `compliance.dfabi.${d.action}`, idempotencyKey: key, request: d },
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
    const type = searchParams.get("type");
    if (type === "check-transfer") {
      const bondId = searchParams.get("bondId") ?? "";
      const from   = searchParams.get("from") ?? "";
      const to     = searchParams.get("to") ?? "";
      const amountStr = searchParams.get("amount");
      const amount = amountStr !== null ? Number(amountStr) : null;
      if (!bondId || !from || !to || amount === null) return NextResponse.json({ error: "bondId, from, to, amount required" }, { status: 400 });
      return NextResponse.json(await complianceDfabi.checkTransfer({ bondId, from, to, amount }));
    }
    if (type === "eligibility") {
      const participant = searchParams.get("participant") ?? "";
      const bondId      = searchParams.get("bondId") ?? "";
      if (!participant || !bondId) return NextResponse.json({ error: "participant, bondId required" }, { status: 400 });
      return NextResponse.json(await complianceDfabi.eligibility({ participant, bondId }));
    }
    return NextResponse.json({ error: "type must be check-transfer or eligibility" }, { status: 400 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
