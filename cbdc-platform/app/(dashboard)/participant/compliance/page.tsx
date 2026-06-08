import { requirePermission } from "@/lib/rbac";
import { complianceGeneral } from "@/lib/dlt/domains/complianceGeneral";
import { complianceDfabi } from "@/lib/dlt/domains/complianceDfabi";
import { db } from "@/lib/db";
import { KpiCard } from "@/components/app/kpi-card";
import { Card } from "@/components/ui/card";

export default async function ParticipantCompliancePage() {
  const user = await requirePermission("compliance.view");
  const addr = user.orgAddress;

  const instruments = await db.instrument.findMany({ where: { bondId: { not: null } } });

  let genStatus: { isEligible: boolean; isSuspended: boolean; lastReviewDate: string; riskCategory: string } | null = null;
  try {
    genStatus = await complianceGeneral.status({ entity: addr, assetId: addr });
  } catch { /* DLT down or not configured */ }

  const dfabiChecks = await Promise.all(
    instruments
      .filter((i) => i.bondId != null)
      .map(async (i) => {
        try {
          const r = await complianceDfabi.eligibility({ participant: addr, bondId: i.bondId! });
          return { name: i.name, bondId: i.bondId!, eligible: r.eligible };
        } catch {
          return { name: i.name, bondId: i.bondId!, eligible: null as boolean | null };
        }
      })
  );

  return (
    <section className="space-y-6">
      <h1 className="font-mono text-lg">Compliance Status</h1>

      {genStatus && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="AML Eligible"  value={genStatus.isEligible  ? "Yes" : "No"} accent={genStatus.isEligible} />
          <KpiCard label="Suspended"     value={genStatus.isSuspended ? "Yes" : "No"} />
          <KpiCard label="Risk Category" value={genStatus.riskCategory} />
          <KpiCard label="Last Review"   value={genStatus.lastReviewDate ? new Date(Number(genStatus.lastReviewDate) * 1000).toLocaleDateString() : "—"} />
        </div>
      )}
      {!genStatus && (
        <p className="text-sm text-muted-foreground">Compliance status unavailable (DLT unreachable).</p>
      )}

      {dfabiChecks.length > 0 && (
        <Card className="p-4 bg-card/80 border-border">
          <h2 className="font-mono text-sm mb-3">DFABI Bond Eligibility</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4">Bond</th>
                <th className="py-2">DFABI Eligible</th>
              </tr>
            </thead>
            <tbody>
              {dfabiChecks.map((c) => (
                <tr key={c.bondId} className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono">{c.name}</td>
                  <td className={`py-2 font-medium ${c.eligible === true ? "text-emerald-400" : c.eligible === false ? "text-destructive" : "text-muted-foreground"}`}>
                    {c.eligible === true ? "Eligible" : c.eligible === false ? "Not Eligible" : "Unknown"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}
