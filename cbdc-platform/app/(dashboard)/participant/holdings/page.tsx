import Link from "next/link";
import { requirePermission } from "@/lib/rbac";
import { getBondHoldings } from "@/lib/dlt/services/holdings";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function HoldingsPage() {
  const user = await requirePermission("bond.view");
  let rows: Awaited<ReturnType<typeof getBondHoldings>> = [];
  try { rows = await getBondHoldings(user.orgAddress); } catch { /* DLT down */ }
  const held = rows.filter((r) => r.total !== "0");
  return (
    <section className="space-y-4">
      <h1 className="font-mono text-lg">Bond Holdings</h1>
      <Table>
        <TableHeader><TableRow><TableHead>Instrument</TableHead><TableHead>Primary</TableHead><TableHead>Secondary</TableHead><TableHead>Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {held.map((r) => (
            <TableRow key={r.instrumentId}>
              <TableCell>{r.name} <span className="text-muted-foreground">({r.symbol})</span></TableCell>
              <TableCell className="tabular">{r.primary}</TableCell>
              <TableCell className="tabular">{r.secondary}</TableCell>
              <TableCell className="tabular font-medium">{r.total}</TableCell>
              <TableCell><Link className="text-primary hover:underline text-sm" href={`/participant/holdings/${r.bondId}`}>Detail</Link></TableCell>
            </TableRow>
          ))}
          {held.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No bond holdings.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </section>
  );
}
