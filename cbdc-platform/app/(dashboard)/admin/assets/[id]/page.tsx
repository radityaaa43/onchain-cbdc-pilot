import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { assetClassOf, type AssetType } from "@/lib/assets/types";
import { ReleasePanel } from "./release-panel";

export default async function AssetDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("asset.release");
  const { id } = await params;
  const inst = await db.instrument.findUnique({ where: { id } });
  if (!inst) notFound();
  const isCash = assetClassOf(inst.assetType as AssetType) === "cash";
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
    </section>
  );
}
