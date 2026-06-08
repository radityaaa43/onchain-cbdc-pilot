import { requirePermission } from "@/lib/rbac";
import { cbdc } from "@/lib/dlt/domains/cbdc";
import { limits } from "@/lib/dlt/domains/limits";
import { redemption } from "@/lib/dlt/domains/redemption";
import { KpiCard } from "@/components/app/kpi-card";
import { WalletActions } from "./wallet-actions";

export default async function WalletPage() {
  const user = await requirePermission("cbdc.view");
  const addr = user.orgAddress;
  let balance = "0", balLimit = "0", dayLimit = "0", redeemed = "0";
  try {
    [balance, balLimit, dayLimit, redeemed] = await Promise.all([
      cbdc.balance(addr).then((r) => r.balance),
      limits.getBalance(addr).then((r) => r.limit).catch(() => "0"),
      limits.getDaily(addr).then((r) => r.limit).catch(() => "0"),
      redemption.total(addr).then((r) => r.total).catch(() => "0"),
    ]);
  } catch { /* DLT down */ }
  return (
    <section className="space-y-6">
      <h1 className="font-mono text-lg">CBDC Wallet</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Balance" value={balance} unit="IDR" accent />
        <KpiCard label="Balance Limit" value={balLimit} unit="IDR" />
        <KpiCard label="Daily Limit" value={dayLimit} unit="IDR" />
        <KpiCard label="Total Redeemed" value={redeemed} unit="IDR" />
      </div>
      <WalletActions />
    </section>
  );
}
