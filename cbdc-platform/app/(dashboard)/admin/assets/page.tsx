import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AssetsPage() {
  await requirePermission("asset.create");
  const instruments = await db.instrument.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-mono text-lg">Assets</h1>
        <Button asChild>
          <Link href="/admin/assets/new">New asset</Link>
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Bond ID</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {instruments.map((i) => (
            <TableRow key={i.id}>
              <TableCell>
                {i.name} <span className="text-muted-foreground">({i.symbol})</span>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{i.assetType}</Badge>
              </TableCell>
              <TableCell>
                <Badge>{i.status}</Badge>
              </TableCell>
              <TableCell className="tabular text-xs text-muted-foreground">
                {i.bondId ? i.bondId.slice(0, 14) + "…" : "—"}
              </TableCell>
              <TableCell>
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/admin/assets/${i.id}`}>Manage</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {instruments.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                No assets yet. Create one to get started.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  );
}
