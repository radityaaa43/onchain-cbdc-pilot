import { requirePermission } from "@/lib/rbac";
import { DfabiActions } from "./dfabi-actions";

export default async function DfabiPage() {
  await requirePermission("compliance.view");
  return (
    <section className="space-y-6">
      <h1 className="font-mono text-lg">DFABI Compliance</h1>
      <DfabiActions />
    </section>
  );
}
