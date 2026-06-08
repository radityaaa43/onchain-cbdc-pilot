import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { startOperation } from "@/lib/operations";
import { bondMetadata } from "@/lib/dlt/domains/bondMetadata";
import { AuthError } from "@/lib/auth/session";

const Body = z.object({
  group: z.enum(["static", "terms", "dlt-platform", "credit-events", "ratings", "indonesian"]),
  data: z.record(z.string(), z.unknown()),
});

const SETTERS = {
  "static": bondMetadata.setStatic,
  "terms": bondMetadata.setTerms,
  "dlt-platform": bondMetadata.setDltPlatform,
  "credit-events": bondMetadata.setCreditEvents,
  "ratings": bondMetadata.setRatings,
  "indonesian": bondMetadata.setIndonesian,
} as const;

export async function POST(req: Request) {
  try {
    const user = await requirePermission("asset.create");
    const idempotencyKey = req.headers.get("idempotency-key");
    if (!idempotencyKey) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const setter = SETTERS[parsed.data.group];
    const { operationId } = await startOperation(
      { userId: user.userId, orgId: user.orgId, action: `bond.metadata.${parsed.data.group}`, idempotencyKey, request: parsed.data },
      () => setter(parsed.data.data).then((r) => ({ result: r })),
    );
    return NextResponse.json({ operationId }, { status: 202 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
