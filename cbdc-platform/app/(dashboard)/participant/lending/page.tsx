import { requirePermission } from "@/lib/rbac";
import { LendingView } from "./lending-view";

export default async function LendingPage() {
  await requirePermission("lending.view");
  return (
    <section className="space-y-4">
      <h1 className="font-mono text-lg">Securities Lending</h1>
      <LendingView />
    </section>
  );
}
