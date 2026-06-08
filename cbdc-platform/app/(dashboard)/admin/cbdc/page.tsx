import { requirePermission } from "@/lib/rbac";
import { cbdc } from "@/lib/dlt/domains/cbdc";
import { KpiCard } from "@/components/app/kpi-card";
import { CbdcActions } from "./cbdc-actions";

export default async function CbdcAdminPage() {
  await requirePermission("cbdc.issue");
  let issued = "0";
  try { issued = (await cbdc.issuedTotal()).total; } catch { /* DLT down */ }
  return (
    <section className="space-y-6">
      <h1 className="font-mono text-lg">CBDC Management</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total CBDC Issued" value={issued} unit="IDR" accent />
      </div>
      <CbdcActions />
    </section>
  );
}
