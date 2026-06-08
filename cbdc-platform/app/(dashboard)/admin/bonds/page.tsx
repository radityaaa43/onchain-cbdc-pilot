import { requirePermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { BondActions } from "./bond-actions";

export default async function BondsAdminPage() {
  await requirePermission("lifecycle.coupon.pay");
  const instruments = await db.instrument.findMany({ where: { bondId: { not: null } }, orderBy: { createdAt: "desc" } });
  const bonds = instruments.map((i) => ({ bondId: i.bondId!, name: i.name }));
  return (
    <section className="space-y-6">
      <h1 className="font-mono text-lg">Bond Lifecycle</h1>
      {bonds.length === 0 ? (
        <p className="text-muted-foreground">No bonds yet. Create one in Assets.</p>
      ) : (
        <BondActions bonds={bonds} />
      )}
    </section>
  );
}
