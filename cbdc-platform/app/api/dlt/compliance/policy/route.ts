import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { compliancePolicy } from "@/lib/dlt/domains/compliancePolicy";
import { AuthError } from "@/lib/auth/session";

const Addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const B32  = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

const AddRuleBody    = z.object({ action: z.literal("add-rule"), ruleId: B32, ruleContract: Addr });
const RemoveRuleBody = z.object({ action: z.literal("remove-rule"), ruleId: B32 });
const SetDefaultBody = z.object({ action: z.literal("set-default"), policyAddress: Addr });
const Body = z.discriminatedUnion("action", [AddRuleBody, RemoveRuleBody, SetDefaultBody]);

export async function POST(req: Request) {
  try {
    const user = await requirePermission("compliance.manage");
    const key = req.headers.get("idempotency-key");
    if (!key) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const d = parsed.data;
    let fn: () => Promise<unknown>;
    if (d.action === "add-rule") fn = () => compliancePolicy.addRule({ ruleId: d.ruleId, ruleContract: d.ruleContract });
    else if (d.action === "remove-rule") fn = () => compliancePolicy.removeRule(d.ruleId);
    else fn = () => compliancePolicy.setDefault(d.policyAddress);
    const { operationId } = await startOperation(
      { userId: user.userId, orgId: user.orgId, action: `compliance.policy.${d.action}`, idempotencyKey: key, request: d },
      () => fn().then((r) => ({ result: r })),
    );
    return NextResponse.json({ operationId }, { status: 202 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
