import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { runOperation } from "@/lib/operations";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AuthError } from "@/lib/auth/session";
import { CreateAssetBody, assetClassOf } from "@/lib/assets/types";
import { createBondOnChain } from "@/lib/dlt/services/assetCreate";

export async function POST(req: Request) {
  try {
    const user = await requirePermission("asset.create");
    const idempotencyKey = req.headers.get("idempotency-key");
    if (!idempotencyKey) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = CreateAssetBody.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const input = parsed.data;

    let bondId: string | null = null;
    let tokenAddress = env.CONTRACT_CBTOKEN;
    if (assetClassOf(input.assetType) === "bond") {
      const op = await runOperation(
        { userId: user.userId, orgId: user.orgId, action: "asset.create", idempotencyKey, request: input },
        () => createBondOnChain(input).then((r) => ({ result: r })),
      );
      if (op.status !== "SUCCESS") return NextResponse.json({ error: (op as any).error ?? "create failed" }, { status: 502 });
      bondId = ((op as any).result as { bondId: string }).bondId;
      tokenAddress = env.CONTRACT_FIXED_INCOME_TOKEN;
    }

    const instrument = await db.instrument.create({
      data: {
        assetType: input.assetType,
        status: "CREATED",
        name: input.name,
        symbol: input.symbol,
        isin: input.isin,
        currency: input.currency,
        tokenAddress,
        bondId,
        couponRateBps: input.couponRateBps,
        maturityDate: input.maturityDate ? new Date(input.maturityDate * 1000) : null,
        principalAmount: input.principalAmount ? String(input.principalAmount) : null,
        dayCount: input.dayCount,
        finalRedemptionPct: input.finalRedemptionPct,
        decimals: input.decimals,
        isSyariah: input.assetType.startsWith("SUKUK"),
        shariahBoard: input.shariahBoard,
        configJson: { currency: input.currency },
        createdById: user.userId,
      },
    });
    return NextResponse.json({ instrument }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function GET() {
  try {
    await requirePermission("asset.create");
    const instruments = await db.instrument.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ instruments, role: env.APP_ROLE });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
