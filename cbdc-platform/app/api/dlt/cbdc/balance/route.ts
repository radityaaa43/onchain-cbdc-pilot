import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { cbdc } from "@/lib/dlt/domains/cbdc";
import { AuthError } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    await requirePermission("cbdc.view");
    const address = new URL(req.url).searchParams.get("address");
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address))
      return NextResponse.json({ error: "valid address query param required" }, { status: 422 });
    return NextResponse.json(await cbdc.balance(address));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 502 });
  }
}
