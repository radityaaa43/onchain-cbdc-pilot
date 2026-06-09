import { requirePermission } from "@/lib/rbac";
import { SettlementFailureView } from "@/app/(dashboard)/admin/settlement-failure/settlement-failure-view";

export default async function ParticipantSettlementFailurePage() {
  await requirePermission("settlement.view");
  return (
    <section className="space-y-4">
      <h1 className="font-mono text-lg">Settlement Issues</h1>
      <SettlementFailureView mode="participant" />
    </section>
  );
}
