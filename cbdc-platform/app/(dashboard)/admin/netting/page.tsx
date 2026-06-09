import { requirePermission } from "@/lib/rbac";
import { NettingView } from "./netting-view";

export default async function NettingPage() {
  await requirePermission("netting.manage");
  return (
    <section className="space-y-4">
      <h1 className="font-mono text-lg">Netting</h1>
      <NettingView />
    </section>
  );
}
