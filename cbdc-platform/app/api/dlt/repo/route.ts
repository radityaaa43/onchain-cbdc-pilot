import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { repo } from "@/lib/dlt/domains/repo";
import { AuthError } from "@/lib/auth/session";

const Addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const B32  = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

const InitiateBody = z.object({
  action: z.literal("initiate"),
  bondId: B32, seller: Addr, buyer: Addr,
  amount: z.number().positive(), repoRate: z.number().nonnegative(), tenor: z.number().positive(),
});
const InitiateHaircutBody = z.object({
  action: z.literal("initiate-with-haircut"),
  bondId: B32, seller: Addr, buyer: Addr,
  amount: z.number().positive(), repoRate: z.number().nonnegative(), tenor: z.number().positive(),
  marketPrice: z.number().positive(), haircut: z.number().nonnegative(), marginCallThreshold: z.number().nonnegative(),
});
const RepoIdBody = z.object({ action: z.enum(["consent-early-termination", "terminate-early", "unwind"]), repoId: B32 });
const MarginCallBody = z.object({ action: z.literal("margin-call"), repoId: B32, currentMarketPrice: z.number().positive() });
const MarginCallRespondBody = z.object({ action: z.literal("margin-call-respond"), repoId: B32, amount: z.number().positive() });
const Body = z.discriminatedUnion("action", [InitiateBody, InitiateHaircutBody, RepoIdBody, MarginCallBody, MarginCallRespondBody]);

export async function POST(req: Request) {
  try {
    const user = await requirePermission("repo.trade");
    const key = req.headers.get("idempotency-key");
    if (!key) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const d = parsed.data;
    let fn: () => Promise<unknown>;
    if (d.action === "initiate")                      fn = () => repo.initiate({ bondId: d.bondId, seller: d.seller, buyer: d.buyer, amount: d.amount, repoRate: d.repoRate, tenor: d.tenor });
    else if (d.action === "initiate-with-haircut")    fn = () => repo.initiateWithHaircut({ bondId: d.bondId, seller: d.seller, buyer: d.buyer, amount: d.amount, repoRate: d.repoRate, tenor: d.tenor, marketPrice: d.marketPrice, haircut: d.haircut, marginCallThreshold: d.marginCallThreshold });
    else if (d.action === "consent-early-termination") fn = () => repo.consentEarlyTermination(d.repoId);
    else if (d.action === "terminate-early")          fn = () => repo.terminateEarly(d.repoId);
    else if (d.action === "unwind")                   fn = () => repo.unwind(d.repoId);
    else if (d.action === "margin-call")              fn = () => repo.marginCall({ repoId: d.repoId, currentMarketPrice: d.currentMarketPrice });
    else                                              fn = () => repo.marginCallRespond({ repoId: d.repoId, amount: d.amount });
    const { operationId } = await startOperation(
      { userId: user.userId, orgId: user.orgId, action: `repo.${d.action}`, idempotencyKey: key, request: d },
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
    await requirePermission("repo.view");
    const repoId = new URL(req.url).searchParams.get("repoId") ?? "";
    if (!repoId) return NextResponse.json({ error: "repoId required" }, { status: 400 });
    return NextResponse.json(await repo.get(repoId));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
