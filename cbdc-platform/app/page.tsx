import { KpiCard } from "@/components/app/kpi-card";
import { Sidebar } from "@/components/app/sidebar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cbdc } from "@/lib/dlt/domains/cbdc";
import { getSession } from "@/lib/auth/session";
import { getBondHoldings } from "@/lib/dlt/services/holdings";
import { db } from "@/lib/db";
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
  let bondTotal = "0";
  let bondInstrumentCount = 0;

  try {
    balance = (await cbdc.balance(user!.orgAddress)).balance;
    if (env.APP_ROLE === "operator") {
      issued = (await cbdc.issuedTotal()).total;
      bondInstrumentCount = await db.instrument.count({ where: { bondId: { not: null } } });
    }
    if (env.APP_ROLE === "participant") {
      const holdings = await getBondHoldings(user!.orgAddress);
      const total = holdings.reduce((acc, h) => acc + BigInt(h.total), BigInt(0));
      bondTotal = total.toString();
    }
  } catch {
    // DLT unreachable — show zeros gracefully
  }

  const recentOps = await db.operation
    .findMany({ where: { orgId: user!.orgId }, orderBy: { createdAt: "desc" }, take: 10 })
    .catch(() => []);

  return (
    <div className="flex min-h-dvh">
      <Sidebar role={env.APP_ROLE} />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0">
          <span className="font-mono text-sm text-muted-foreground">{env.APP_ROLE.toUpperCase()}</span>
          <span className="text-sm text-foreground">{user!.name} · {user!.orgType}</span>
        </header>
        <main className="flex-1 p-6 space-y-8">
          <section>
            <h1 className="font-mono text-lg mb-4">Overview</h1>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard label="Org CBDC Balance" value={balance} unit="IDR" accent />
              {env.APP_ROLE === "operator" && (
                <KpiCard label="Total CBDC Issued" value={issued} unit="IDR" />
              )}
              {env.APP_ROLE === "operator" && (
                <KpiCard label="Bond Instruments" value={String(bondInstrumentCount)} />
              )}
              {env.APP_ROLE === "participant" && (
                <KpiCard label="Bond Holdings Total" value={bondTotal} unit="units" />
              )}
            </div>
          </section>

          <section>
            <h2 className="font-mono text-base mb-3">Recent Events</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tx</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOps.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell className="tabular text-xs text-muted-foreground">
                      {op.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{op.action}</TableCell>
                    <TableCell>
                      <Badge variant={op.status === "SUCCESS" ? "default" : op.status === "FAILED" ? "destructive" : "secondary"}>
                        {op.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular text-xs text-muted-foreground">
                      {op.txHash ? op.txHash.slice(0, 10) + "…" : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {recentOps.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No events yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </section>
        </main>
      </div>
    </div>
  );
}
