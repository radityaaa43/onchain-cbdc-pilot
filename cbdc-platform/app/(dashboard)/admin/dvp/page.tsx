import { requirePermission } from "@/lib/rbac";
import { DvpStatusLookup } from "./dvp-status";

export default async function DvpMonitorPage() {
  await requirePermission("dvp.view");
  return (
    <section className="space-y-6 max-w-2xl">
      <h1 className="font-mono text-lg">DVP Monitor</h1>
      <p className="text-sm text-muted-foreground">
        Lookup, fail, or cancel settlements. Note: happy-path confirm requires participant affirmation (see roadmap).
      </p>
      <DvpStatusLookup />
    </section>
  );
}
