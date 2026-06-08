import { requirePermission } from "@/lib/rbac";
import { AmlActions } from "./aml-actions";

export default async function AmlPage() {
  await requirePermission("compliance.view");
  return (
    <section className="space-y-6">
      <h1 className="font-mono text-lg">AML / KYC Compliance</h1>
      <AmlActions />
    </section>
  );
}
