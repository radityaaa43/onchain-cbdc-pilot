import { KpiCard } from "@/components/app/kpi-card";
import { Sidebar } from "@/components/app/sidebar";
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
    <div className="flex min-h-dvh">
      <Sidebar role={env.APP_ROLE} />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0">
          <span className="font-mono text-sm text-muted-foreground">{env.APP_ROLE.toUpperCase()}</span>
          <span className="text-sm text-foreground">{user!.name} · {user!.orgType}</span>
        </header>
        <main className="flex-1 p-6">
          <section>
            <h1 className="font-mono text-lg mb-4">Overview</h1>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard label="Org CBDC Balance" value={balance} unit="IDR" accent />
              {env.APP_ROLE === "operator" && (
                <KpiCard label="Total CBDC Issued" value={issued} unit="IDR" />
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
