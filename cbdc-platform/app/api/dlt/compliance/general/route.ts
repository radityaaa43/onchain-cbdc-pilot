import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { complianceGeneral } from "@/lib/dlt/domains/complianceGeneral";
import { AuthError } from "@/lib/auth/session";

const Addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

const EligibleBody   = z.object({ action: z.literal("eligible"), participant: Addr, assetId: Addr, eligible: z.boolean() });
const SuspendBody    = z.object({ action: z.literal("suspend"), participant: Addr, suspended: z.boolean(), reason: z.string().min(1) });
const RiskBody       = z.object({ action: z.literal("risk-category"), participant: Addr, riskCategory: z.string().min(1) });
const SuspiciousBody = z.object({ action: z.literal("report-suspicious"), entity: Addr, reason: z.string().min(1), data: z.string().optional() });
const Body = z.discriminatedUnion("action", [EligibleBody, SuspendBody, RiskBody, SuspiciousBody]);

export async function POST(req: Request) {
  try {
    const user = await requirePermission("compliance.manage");
    const key = req.headers.get("idempotency-key");
    if (!key) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const d = parsed.data;
    let fn: () => Promise<unknown>;
    if (d.action === "eligible") fn = () => complianceGeneral.setEligible({ participant: d.participant, assetId: d.assetId, eligible: d.eligible });
    else if (d.action === "suspend") fn = () => complianceGeneral.setSuspended({ participant: d.participant, suspended: d.suspended, reason: d.reason });
    else if (d.action === "risk-category") fn = () => complianceGeneral.setRiskCategory({ participant: d.participant, riskCategory: d.riskCategory });
    else fn = () => complianceGeneral.reportSuspicious({ entity: d.entity, reason: d.reason, data: d.data });
    const { operationId } = await startOperation(
      { userId: user.userId, orgId: user.orgId, action: `compliance.general.${d.action}`, idempotencyKey: key, request: d },
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
    if (type === "status") {
      const entity  = searchParams.get("entity") ?? "";
      const assetId = searchParams.get("assetId") ?? "";
      if (!entity || !assetId) return NextResponse.json({ error: "entity, assetId required" }, { status: 400 });
      return NextResponse.json(await complianceGeneral.status({ entity, assetId }));
    }
    if (type === "check-transfer") {
      const from    = searchParams.get("from") ?? "";
      const to      = searchParams.get("to") ?? "";
      const assetId = searchParams.get("assetId") ?? "";
      if (!from || !to || !assetId) return NextResponse.json({ error: "from, to, assetId required" }, { status: 400 });
      return NextResponse.json(await complianceGeneral.checkTransfer({ from, to, assetId }));
    }
    return NextResponse.json({ error: "type must be status or check-transfer" }, { status: 400 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
