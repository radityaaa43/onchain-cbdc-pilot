import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { reporting } from "@/lib/dlt/domains/reporting";
import { AuthError } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    await requirePermission("compliance.view");
    const { searchParams } = new URL(req.url);
    if (searchParams.get("paginated") === "true") {
      const offset = Number(searchParams.get("offset") ?? "0");
      const limit  = Number(searchParams.get("limit") ?? "20");
      return NextResponse.json(await reporting.exportPaginated({ offset, limit }));
    }
    const assetId   = searchParams.get("assetId") ?? "";
    const fromBlock = searchParams.get("fromBlock") ?? "";
    const toBlock   = searchParams.get("toBlock") ?? "";
    if (!assetId || !fromBlock || !toBlock)
      return NextResponse.json({ error: "assetId, fromBlock, toBlock required (or paginated=true)" }, { status: 400 });
    return NextResponse.json(await reporting.exportRaw({ assetId, fromBlock, toBlock }));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
