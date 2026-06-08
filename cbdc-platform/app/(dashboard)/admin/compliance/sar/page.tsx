import { requirePermission } from "@/lib/rbac";
import { SarActions } from "./sar-actions";

export default async function SarPage() {
  await requirePermission("compliance.view");
  return (
    <section className="space-y-6">
      <h1 className="font-mono text-lg">Suspicious Activity Reports (SAR)</h1>
      <SarActions />
    </section>
  );
}
