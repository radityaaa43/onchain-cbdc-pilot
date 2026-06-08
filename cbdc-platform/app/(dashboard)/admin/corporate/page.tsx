import { requirePermission } from "@/lib/rbac";
import { CorporateActionsView } from "./corporate-actions";

export default async function CorporatePage() {
  await requirePermission("corporate.view");
  return (
    <section className="space-y-4">
      <h1 className="font-mono text-lg">Corporate Actions</h1>
      <CorporateActionsView />
    </section>
  );
}
