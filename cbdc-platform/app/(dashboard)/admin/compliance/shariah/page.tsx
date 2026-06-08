import { requirePermission } from "@/lib/rbac";
import { ShariahActions } from "./shariah-actions";

export default async function ShariahPage() {
  await requirePermission("compliance.view");
  return (
    <section className="space-y-6">
      <h1 className="font-mono text-lg">Shariah Compliance</h1>
      <ShariahActions />
    </section>
  );
}
