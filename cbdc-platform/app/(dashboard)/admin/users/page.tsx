import { requirePermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { UserForm } from "./user-form";
import { AuditTable } from "./audit-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function UsersAdminPage() {
  const me = await requirePermission("user.manage");
  const [orgs, users] = await Promise.all([
    db.org.findMany(),
    db.user.findMany({ include: { org: true, roles: true }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <section className="space-y-8">
      <h1 className="font-mono text-lg">Users &amp; Audit</h1>
      <UserForm orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} />
      <div>
        <h2 className="font-mono text-sm mb-3">Users</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Org</TableHead><TableHead>Roles</TableHead><TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.org.name}</TableCell>
                <TableCell className="text-xs">{u.roles.map((r) => r.role).join(", ")}</TableCell>
                <TableCell>{u.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div>
        <h2 className="font-mono text-sm mb-3">Audit log (recent)</h2>
        <AuditTable orgId={me.orgId} />
      </div>
    </section>
  );
}
