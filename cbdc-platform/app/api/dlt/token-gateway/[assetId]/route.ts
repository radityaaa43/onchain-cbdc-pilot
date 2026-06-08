import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { tokenGateway } from "@/lib/dlt/domains/tokenGateway";
import { AuthError } from "@/lib/auth/session";

export async function GET(_req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    await requirePermission("asset.create");
    const { assetId } = await params;
    const [addr, type, reg] = await Promise.allSettled([
      tokenGateway.address(assetId),
      tokenGateway.type(assetId),
      tokenGateway.registered(assetId),
    ]);
    return NextResponse.json({
      address:    addr.status    === "fulfilled" ? addr.value.address    : null,
      assetType:  type.status    === "fulfilled" ? type.value.assetType  : null,
      registered: reg.status     === "fulfilled" ? reg.value.registered  : null,
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
