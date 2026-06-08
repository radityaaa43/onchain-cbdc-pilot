"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const ROLES = ["OPERATOR_ADMIN","ISSUANCE_OFFICER","COMPLIANCE_OFFICER","PARTICIPANT_ADMIN","TRADER","OPS","COMPLIANCE_VIEWER"];

export function UserForm({ orgs }: { orgs: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const roles = ROLES.filter((r) => f.get(`role_${r}`) === "on");
    setBusy(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: f.get("email"), name: f.get("name"), password: f.get("password"), orgId: f.get("orgId"), roles }),
    });
    setBusy(false);
    if (!res.ok) { toast.error("Create failed: " + JSON.stringify((await res.json()).error)); return; }
    toast.success("User created");
    router.refresh();
  }
  return (
    <Card className="p-4 bg-card/80 border-border">
      <h2 className="font-mono text-sm mb-3">New user</h2>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" name="name" required /></div>
          <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
          <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" required minLength={8} /></div>
          <div className="space-y-2">
            <Label htmlFor="orgId">Org</Label>
            <select id="orgId" name="orgId" className="w-full h-10 rounded-md bg-muted border border-border px-3 text-sm">
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm text-muted-foreground">Roles</legend>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={`role_${r}`} className="accent-primary" />{r}
              </label>
            ))}
          </div>
        </fieldset>
        <Button type="submit" disabled={busy} className="glow-primary">{busy ? "Creating…" : "Create user"}</Button>
      </form>
    </Card>
  );
}
