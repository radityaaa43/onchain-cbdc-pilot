import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { bonds } from "@/lib/dlt/domains/bonds";
import { coupon } from "@/lib/dlt/domains/coupon";
import { maturity } from "@/lib/dlt/domains/maturity";
import { KpiCard } from "@/components/app/kpi-card";

export default async function HoldingDetail({ params }: { params: Promise<{ bondId: string }> }) {
  const user = await requirePermission("bond.view");
  const { bondId } = await params;
  const inst = await db.instrument.findFirst({ where: { bondId } });
  if (!inst) notFound();
  let primary = "0", secondary = "0", couponAmt = "0", matured = false, mat = { maturityDate: "0" };
  try {
    [primary, secondary, couponAmt] = await Promise.all([
      bonds.balance(bondId, user.orgAddress, "PRIMARY").then((r) => r.balance).catch(() => "0"),
      bonds.balance(bondId, user.orgAddress, "SECONDARY").then((r) => r.balance).catch(() => "0"),
      coupon.calculate(bondId).then((r) => r.couponAmount).catch(() => "0"),
    ]);
    matured = (await bonds.matured(bondId).catch(() => ({ matured: false }))).matured;
    mat = await maturity.info(bondId).catch(() => ({ maturityDate: "0" } as any));
  } catch { /* DLT down */ }
  return (
    <section className="space-y-6">
      <h1 className="font-mono text-lg">{inst.name} <span className="text-muted-foreground">({inst.symbol})</span></h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Primary" value={primary} accent />
        <KpiCard label="Secondary" value={secondary} />
        <KpiCard label="Accrued Coupon" value={couponAmt} unit="IDR" />
        <KpiCard label="Matured" value={matured ? "Yes" : "No"} />
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm max-w-md">
        <dt className="text-muted-foreground">Bond ID</dt><dd className="tabular text-xs break-all">{bondId}</dd>
        <dt className="text-muted-foreground">Coupon rate</dt><dd className="tabular">{inst.couponRateBps ?? "—"} bps</dd>
        <dt className="text-muted-foreground">Maturity (unix)</dt><dd className="tabular">{mat.maturityDate}</dd>
      </dl>
    </section>
  );
}
