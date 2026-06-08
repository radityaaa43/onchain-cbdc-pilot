import { requirePermission } from "@/lib/rbac";
import { MetadataForm } from "./metadata-form";

export default async function BondMetadataPage() {
  await requirePermission("asset.create");
  return (
    <section className="space-y-4">
      <h1 className="font-mono text-lg">Bond Metadata</h1>
      <p className="text-sm text-muted-foreground">
        Author the BondMetadataRegistry groups (static set at create; terms, dlt-platform, credit-events, ratings, indonesian-market here). DFABI-aligned.
      </p>
      <MetadataForm />
    </section>
  );
}
