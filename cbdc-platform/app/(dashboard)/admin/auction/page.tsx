import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AuctionListPage() {
  await requirePermission("auction.view");
  const rounds = await db.auctionRound.findMany({ orderBy: { createdAt: "desc" }, include: { allocations: true } });
  return (
    <section>
      <h1 className="font-mono text-lg mb-4">Auctions</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>ISIN</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Allocations</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rounds.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <Link className="text-primary hover:underline" href={`/admin/auction/${r.id}`}>
                  {r.name}
                </Link>
              </TableCell>
              <TableCell className="tabular">{r.isin}</TableCell>
              <TableCell>
                <Badge>{r.status}</Badge>
              </TableCell>
              <TableCell className="tabular">{r.allocations.length}</TableCell>
            </TableRow>
          ))}
          {rounds.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                No auctions. Publish a bond asset to create one.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  );
}
