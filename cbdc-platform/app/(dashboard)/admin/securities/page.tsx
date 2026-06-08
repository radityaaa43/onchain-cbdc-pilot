import { requirePermission } from "@/lib/rbac";
import { RepoDeskView } from "./repo-desk";
import { LendingDeskView } from "./lending-desk";

export default async function SecuritiesDeskPage() {
  await requirePermission("repo.view");
  return (
    <section className="space-y-6">
      <h1 className="font-mono text-lg">Securities Desk</h1>
      <div className="space-y-6">
        <RepoDeskView />
        <LendingDeskView />
      </div>
    </section>
  );
}
