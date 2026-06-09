import { requirePermission } from "@/lib/rbac";
import { SettlementFailureView } from "./settlement-failure-view";

export default async function SettlementFailurePage() {
  await requirePermission("settlement.manage");
  return (
    <section className="space-y-4">
      <h1 className="font-mono text-lg">Settlement Failure</h1>
      <SettlementFailureView mode="operator" />
    </section>
  );
}
