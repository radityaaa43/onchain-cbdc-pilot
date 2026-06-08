import { db } from "@/lib/db";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export async function AuditTable({ orgId }: { orgId: string }) {
  const logs = await db.auditLog.findMany({ where: { orgId }, orderBy: { createdAt: "desc" }, take: 50, include: { user: true } });
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Result</TableHead><TableHead>Tx</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((l) => (
          <TableRow key={l.id}>
            <TableCell className="tabular text-xs">{l.createdAt.toISOString().slice(0, 19).replace("T", " ")}</TableCell>
            <TableCell>{l.user?.name ?? l.userId}</TableCell>
            <TableCell className="font-mono text-xs">{l.action}</TableCell>
            <TableCell><Badge variant={l.result === "ok" ? "default" : "destructive"}>{l.result}</Badge></TableCell>
            <TableCell className="tabular text-xs">{l.txHash ? l.txHash.slice(0, 10) + "…" : "—"}</TableCell>
          </TableRow>
        ))}
        {logs.length === 0 && (
          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No audit entries.</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  );
}
