import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { assetClassOf, type AssetType } from "@/lib/assets/types";
import { ReleasePanel } from "./release-panel";
import { Card } from "@/components/ui/card";

export default async function AssetDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("asset.release");
  const { id } = await params;
  const inst = await db.instrument.findUnique({ where: { id } });
  if (!inst) notFound();
  const isCash = assetClassOf(inst.assetType as AssetType) === "cash";

  let gwMeta: { address: string | null; assetType: number | null; registered: boolean | null } | null = null;
  if (inst.bondId) {
    try {
      const { headers } = await import("next/headers");
      const cookieHeader = (await headers()).get("cookie") ?? "";
      const base = process.env.NEXTAUTH_URL ?? "http://localhost:3001";
      const res = await fetch(`${base}/api/dlt/token-gateway/${inst.bondId}`, {
        headers: { cookie: cookieHeader },
        cache: "no-store",
      });
      if (res.ok) gwMeta = await res.json();
    } catch { /* optional metadata */ }
  }

  return (
    <section className="max-w-2xl space-y-4">
      <h1 className="font-mono text-lg">
        {inst.name} <span className="text-muted-foreground">({inst.symbol})</span>
      </h1>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted-foreground">Type</dt>
        <dd>{inst.assetType}</dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd>{inst.status}</dd>
        <dt className="text-muted-foreground">Token</dt>
        <dd className="tabular text-xs">{inst.tokenAddress}</dd>
        {inst.bondId && (
          <>
            <dt className="text-muted-foreground">Bond ID</dt>
            <dd className="tabular text-xs break-all">{inst.bondId}</dd>
          </>
        )}
      </dl>
      <ReleasePanel id={inst.id} status={inst.status} isCash={isCash} />
      {gwMeta && (
        <Card className="p-4 bg-card/80 border-border">
          <h2 className="font-mono text-sm mb-3">Token Gateway</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Contract address</dt>
            <dd className="font-mono truncate">{gwMeta.address ?? "—"}</dd>
            <dt className="text-muted-foreground">Asset type</dt>
            <dd>{gwMeta.assetType ?? "—"}</dd>
            <dt className="text-muted-foreground">Registered</dt>
            <dd className={gwMeta.registered ? "text-emerald-400" : "text-muted-foreground"}>
              {gwMeta.registered == null ? "—" : gwMeta.registered ? "Yes" : "No"}
            </dd>
          </dl>
        </Card>
      )}
    </section>
  );
}
