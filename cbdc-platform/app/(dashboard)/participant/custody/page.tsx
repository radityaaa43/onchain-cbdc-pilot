import { requirePermission } from "@/lib/rbac";
import { CustodyView } from "./custody-view";

export default async function CustodyPage() {
  await requirePermission("custody.view");
  return (
    <section className="space-y-4">
      <h1 className="font-mono text-lg">Custody</h1>
      <CustodyView />
    </section>
  );
}
