import { KpiCard } from "@/components/app/kpi-card";
import { cbdc } from "@/lib/dlt/domains/cbdc";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  let user;
  try {
    user = await getSession();
  } catch {
    redirect("/login");
  }

  let issued = "0";
  let balance = "0";
  try {
    if (env.APP_ROLE === "operator") {
      issued = (await cbdc.issuedTotal()).total;
    }
    balance = (await cbdc.balance(user!.orgAddress)).balance;
  } catch {
    // DLT unreachable in dev — show zeros gracefully
  }

  return (
    <section>
      <h1 className="font-mono text-lg mb-4">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Org CBDC Balance" value={balance} unit="IDR" accent />
        {env.APP_ROLE === "operator" && (
          <KpiCard label="Total CBDC Issued" value={issued} unit="IDR" />
        )}
      </div>
    </section>
  );
}
