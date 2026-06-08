import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth/session";

const Body = z.object({ instrumentId: z.string().min(1), name: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const user = await requirePermission("auction.create");
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const inst = await db.instrument.findUnique({ where: { id: parsed.data.instrumentId } });
    if (!inst) return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
    const round = await db.auctionRound.create({
      data: { instrumentId: inst.id, bondId: inst.bondId, isin: inst.isin ?? inst.symbol, name: parsed.data.name, createdById: user.userId },
    });
    return NextResponse.json({ round }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
