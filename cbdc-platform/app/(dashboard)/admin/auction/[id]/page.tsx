import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AllocationForm } from "@/components/app/allocation-form";
import { SettleButton } from "./settle-button";

export default async function AuctionDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("auction.view");
  const { id } = await params;
  const round = await db.auctionRound.findUnique({ where: { id }, include: { allocations: { include: { org: true } } } });
  if (!round) notFound();
  const orgs = await db.org.findMany({ where: { isSelf: false } });
  const settled = round.status === "SETTLED";
  return (
    <section className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-lg">
          {round.name} <span className="text-muted-foreground">· {round.isin}</span>
        </h1>
        <Badge>{round.status}</Badge>
      </div>
      {!settled && <AllocationForm auctionId={round.id} orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} />}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Winner</TableHead>
            <TableHead>Bond</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>CBDC</TableHead>
            <TableHead>Settled</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {round.allocations.map((a) => (
            <TableRow key={a.id}>
              <TableCell>{a.org.name}</TableCell>
              <TableCell className="tabular">{a.bondAmount}</TableCell>
              <TableCell className="tabular">{a.price}</TableCell>
              <TableCell className="tabular">{a.cbdcAmount}</TableCell>
              <TableCell>
                {a.settled ? (
                  <span className="text-green-400">✓</span>
                ) : (
                  <span className="text-yellow-400">pending</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {round.allocations.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                No allocations yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {round.allocations.length > 0 && <SettleButton auctionId={round.id} disabled={settled} />}
    </section>
  );
}
