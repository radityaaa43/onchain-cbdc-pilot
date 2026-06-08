import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth/session";
import { assetClassOf, type AssetType } from "@/lib/assets/types";
import { releaseCash } from "@/lib/dlt/services/assetRelease";

const CashBody = z.object({ to: z.string().regex(/^0x[0-9a-fA-F]{40}$/), amount: z.number().int().positive() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("asset.release");
    const idempotencyKey = req.headers.get("idempotency-key");
    if (!idempotencyKey) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const { id } = await params;
    const inst = await db.instrument.findUnique({ where: { id } });
    if (!inst) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (inst.status !== "CREATED") return NextResponse.json({ error: `Cannot release from status ${inst.status}` }, { status: 409 });

    if (assetClassOf(inst.assetType as AssetType) === "cash") {
      const parsed = CashBody.safeParse(await req.json());
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
      const { operationId } = await startOperation(
        { userId: user.userId, orgId: user.orgId, action: "asset.release.cash", idempotencyKey, request: { id, ...parsed.data } },
        () => releaseCash(parsed.data).then((r) => ({ result: r })),
      );
      await db.instrument.update({ where: { id }, data: { status: "RELEASED" } });
      return NextResponse.json({ mode: "cash", operationId }, { status: 202 });
    }

    const round = await db.auctionRound.create({
      data: { instrumentId: id, bondId: inst.bondId, isin: inst.isin ?? inst.symbol, name: inst.name, createdById: user.userId },
    });
    await db.instrument.update({ where: { id }, data: { status: "PUBLISHED" } });
    return NextResponse.json({ mode: "auction", auctionId: round.id }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
