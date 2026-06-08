import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { reporting } from "@/lib/dlt/domains/reporting";
import { AuthError } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    await requirePermission("compliance.view");
    const { searchParams } = new URL(req.url);
    const entity    = searchParams.get("entity") ?? "";
    const fromBlock = searchParams.get("fromBlock") ?? "";
    const toBlock   = searchParams.get("toBlock") ?? "";
    if (!entity || !fromBlock || !toBlock)
      return NextResponse.json({ error: "entity, fromBlock, toBlock required" }, { status: 400 });
    return NextResponse.json(await reporting.transactions({ entity, fromBlock, toBlock }));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
