import { requirePermission } from "@/lib/rbac";
import { PolicyActions } from "./policy-actions";

export default async function PolicyPage() {
  await requirePermission("compliance.view");
  return (
    <section className="space-y-6">
      <h1 className="font-mono text-lg">Policy Engine</h1>
      <PolicyActions />
    </section>
  );
}
