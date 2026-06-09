import { requirePermission } from "@/lib/rbac";
import { OracleView } from "./oracle-view";

export default async function OraclePage() {
  await requirePermission("oracle.manage");
  return (
    <section className="space-y-4">
      <h1 className="font-mono text-lg">Oracle</h1>
      <OracleView />
    </section>
  );
}
