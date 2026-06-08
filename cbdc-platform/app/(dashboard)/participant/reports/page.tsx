import { requirePermission } from "@/lib/rbac";
import { ReportsView } from "./reports-view";

export default async function ReportsPage() {
  await requirePermission("compliance.view");
  return (
    <section className="space-y-6">
      <h1 className="font-mono text-lg">Transaction Reports</h1>
      <ReportsView />
    </section>
  );
}
