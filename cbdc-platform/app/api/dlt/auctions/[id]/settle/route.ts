import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { runOperation } from "@/lib/operations";
import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth/session";
import { settleAllocation } from "@/lib/dlt/services/auctionSettle";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("auction.settle");
    const idempotencyKey = req.headers.get("idempotency-key");
    if (!idempotencyKey) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const { id } = await params;
    const round = await db.auctionRound.findUnique({ where: { id }, include: { allocations: { include: { org: true } } } });
    if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });
    if (round.status === "SETTLED") return NextResponse.json({ error: "Already settled" }, { status: 409 });

    // Org ownership: only the org that created the round may settle it.
    const creator = await db.user.findUnique({ where: { id: round.createdById }, select: { orgId: true } });
    if (!creator || creator.orgId !== user.orgId) {
      return NextResponse.json({ error: "Forbidden: round belongs to another org" }, { status: 403 });
    }

    const ops: { allocationId: string; operationId: string }[] = [];
    for (const a of round.allocations) {
      if (a.settled) continue;
      // runOperation (sync) — SETTLED only set after all on-chain calls succeed.
      const op = await runOperation(
        { userId: user.userId, orgId: user.orgId, action: "auction.settle", idempotencyKey: `${idempotencyKey}:${a.id}`, request: { allocationId: a.id } },
        async () => {
          const r = await settleAllocation({ bondId: round.bondId, winnerAddress: a.org.onchainAddress, bondAmount: Number(a.bondAmount) });
          await db.allocation.update({ where: { id: a.id }, data: { settled: true } });
          return { result: r };
        },
      );
      if (op.status === "FAILED") {
        return NextResponse.json({ error: `Allocation ${a.id} failed: ${op.error}`, ops }, { status: 500 });
      }
      ops.push({ allocationId: a.id, operationId: op.id });
    }
    await db.auctionRound.update({ where: { id }, data: { status: "SETTLED" } });
    if (round.instrumentId) await db.instrument.update({ where: { id: round.instrumentId }, data: { status: "SETTLED" } });
    return NextResponse.json({ ops }, { status: 200 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
