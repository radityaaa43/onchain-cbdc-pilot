import { requirePermission } from "@/lib/rbac";
import { PledgeView } from "./pledge-view";

export default async function PledgePage() {
  await requirePermission("pledge.view");
  return (
    <section className="space-y-4">
      <h1 className="font-mono text-lg">Pledge</h1>
      <PledgeView />
    </section>
  );
}
