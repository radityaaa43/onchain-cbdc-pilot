import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { corporateAction } from "@/lib/dlt/domains/corporateAction";
import { AuthError } from "@/lib/auth/session";

const B32  = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

const ScheduleCallBody       = z.object({ action: z.literal("schedule-call-option"),        bondId: B32, callDate: z.number().positive(), callPriceBps: z.number().positive() });
const ExecuteCallBody        = z.object({ action: z.literal("execute-call-batch"),           bondId: B32 });
const ExecuteCallPagedBody   = z.object({ action: z.literal("execute-call-batch-paginated"), bondId: B32, startIndex: z.number().nonnegative(), endIndex: z.number().positive() });
const RegisterPutBody        = z.object({ action: z.literal("register-put-option"),          bondId: B32, putDate: z.number().positive(), putPriceBps: z.number().positive() });
const ExercisePutBody        = z.object({ action: z.literal("exercise-put-option"),          bondId: B32, amount: z.number().positive() });
const ProposeRestructBody    = z.object({ action: z.literal("propose-restructuring"),        bondId: B32, newCouponRateBps: z.number().nonnegative(), newMaturityExtDays: z.number().nonnegative() });
const ProposalIdBody         = z.object({ action: z.enum(["approve-restructuring", "execute-restructuring", "reject-restructuring", "finalize-consent"]), proposalId: B32 });
const ScheduleTenderBody     = z.object({ action: z.literal("schedule-tender-offer"),        bondId: B32, openDate: z.number().positive(), closeDate: z.number().positive(), tenderPriceBps: z.number().positive() });
const TenderBondsBody        = z.object({ action: z.literal("tender-bonds"),                 bondId: B32, amount: z.number().positive() });
const CloseTenderBody        = z.object({ action: z.literal("close-tender-offer"),           bondId: B32 });
const ProposeConsentBody     = z.object({ action: z.literal("propose-consent"),              bondId: B32, description: z.string().min(1), votingDurationDays: z.number().positive(), quorumBps: z.number().positive() });
const VoteConsentBody        = z.object({ action: z.literal("vote-consent"),                 proposalId: B32, inFavor: z.boolean() });

const Body = z.discriminatedUnion("action", [
  ScheduleCallBody, ExecuteCallBody, ExecuteCallPagedBody,
  RegisterPutBody, ExercisePutBody,
  ProposeRestructBody, ProposalIdBody,
  ScheduleTenderBody, TenderBondsBody, CloseTenderBody,
  ProposeConsentBody, VoteConsentBody,
]);

export async function POST(req: Request) {
  try {
    const user = await requirePermission("corporate.manage");
    const key = req.headers.get("idempotency-key");
    if (!key) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const d = parsed.data;
    let fn: () => Promise<unknown>;
    if      (d.action === "schedule-call-option")          fn = () => corporateAction.scheduleCallOption({ bondId: d.bondId, callDate: d.callDate, callPriceBps: d.callPriceBps });
    else if (d.action === "execute-call-batch")            fn = () => corporateAction.executeCallBatch(d.bondId);
    else if (d.action === "execute-call-batch-paginated")  fn = () => corporateAction.executeCallBatchPaginated({ bondId: d.bondId, startIndex: d.startIndex, endIndex: d.endIndex });
    else if (d.action === "register-put-option")           fn = () => corporateAction.registerPutOption({ bondId: d.bondId, putDate: d.putDate, putPriceBps: d.putPriceBps });
    else if (d.action === "exercise-put-option")           fn = () => corporateAction.exercisePutOption({ bondId: d.bondId, amount: d.amount });
    else if (d.action === "propose-restructuring")         fn = () => corporateAction.proposeRestructuring({ bondId: d.bondId, newCouponRateBps: d.newCouponRateBps, newMaturityExtDays: d.newMaturityExtDays });
    else if (d.action === "approve-restructuring")         fn = () => corporateAction.approveRestructuring(d.proposalId);
    else if (d.action === "execute-restructuring")         fn = () => corporateAction.executeRestructuring(d.proposalId);
    else if (d.action === "reject-restructuring")          fn = () => corporateAction.rejectRestructuring(d.proposalId);
    else if (d.action === "schedule-tender-offer")         fn = () => corporateAction.scheduleTenderOffer({ bondId: d.bondId, openDate: d.openDate, closeDate: d.closeDate, tenderPriceBps: d.tenderPriceBps });
    else if (d.action === "tender-bonds")                  fn = () => corporateAction.tenderBonds({ bondId: d.bondId, amount: d.amount });
    else if (d.action === "close-tender-offer")            fn = () => corporateAction.closeTenderOffer(d.bondId);
    else if (d.action === "propose-consent")               fn = () => corporateAction.proposeConsent({ bondId: d.bondId, description: d.description, votingDurationDays: d.votingDurationDays, quorumBps: d.quorumBps });
    else if (d.action === "vote-consent")                  fn = () => corporateAction.voteConsent({ proposalId: d.proposalId, inFavor: d.inFavor });
    else                                                   fn = () => corporateAction.finalizeConsent(d.proposalId);
    const { operationId } = await startOperation(
      { userId: user.userId, orgId: user.orgId, action: `corporate.${d.action}`, idempotencyKey: key, request: d },
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
    await requirePermission("corporate.view");
    return NextResponse.json(await corporateAction.lastProposalId());
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
