import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth/session";

const Body = z.object({
  orgId: z.string().min(1),
  bondAmount: z.number().int().positive(),
  price: z.number().int().positive(),
  cbdcAmount: z.number().int().positive(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("auction.allocate");
    const { id } = await params;
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const round = await db.auctionRound.findUnique({ where: { id } });
    if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });
    if (round.status === "SETTLED") return NextResponse.json({ error: "Round already settled" }, { status: 409 });
    const org = await db.org.findUnique({ where: { id: parsed.data.orgId } });
    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });
    const allocation = await db.allocation.create({
      data: {
        auctionId: id,
        orgId: org.id,
        bondAmount: String(parsed.data.bondAmount),
        price: String(parsed.data.price),
        cbdcAmount: String(parsed.data.cbdcAmount),
      },
    });
    await db.auctionRound.update({ where: { id }, data: { status: "ALLOCATED" } });
    return NextResponse.json({ allocation }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
