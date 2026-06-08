"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/app/money-input";
import { OperationStatus } from "@/components/app/operation-status";
import { toast } from "sonner";

function useOp() {
  const [opId, setOpId] = useState<string | null>(null);
  async function run(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { toast.error("Failed: " + JSON.stringify(data.error)); return; }
    setOpId(data.operationId);
    toast.success("Submitted");
  }
  return { opId, run };
}

export function CbdcActions() {
  const issue = useOp();
  const limit = useOp();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Issue CBDC</h2>
        <form
          onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); issue.run("/api/dlt/cbdc/issue", { to: f.get("to"), amount: Number(f.get("amount")) }); }}
          className="space-y-3"
        >
          <div className="space-y-2"><Label htmlFor="to">To address</Label><Input id="to" name="to" required /></div>
          <div className="space-y-2"><Label htmlFor="amount">Amount</Label><MoneyInput id="amount" name="amount" required /></div>
          <Button type="submit" className="glow-primary">Issue</Button>
          {issue.opId && <p className="text-sm mt-2">Status: <OperationStatus operationId={issue.opId} /></p>}
        </form>
      </Card>
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Set Limit</h2>
        <form
          onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); limit.run("/api/dlt/cbdc/limits", { kind: f.get("kind"), account: f.get("account"), limit: Number(f.get("limit")) }); }}
          className="space-y-3"
        >
          <div className="space-y-2">
            <Label htmlFor="kind">Kind</Label>
            <select id="kind" name="kind" className="w-full h-10 rounded-md bg-muted border border-border px-3 text-sm">
              <option value="balance">Balance</option>
              <option value="daily">Daily</option>
            </select>
          </div>
          <div className="space-y-2"><Label htmlFor="account">Account</Label><Input id="account" name="account" required /></div>
          <div className="space-y-2"><Label htmlFor="limit">Limit</Label><MoneyInput id="limit" name="limit" required /></div>
          <Button type="submit">Set limit</Button>
          {limit.opId && <p className="text-sm mt-2">Status: <OperationStatus operationId={limit.opId} /></p>}
        </form>
      </Card>
      <BalanceLookup />
    </div>
  );
}

export function BalanceLookup() {
  const [bal, setBal] = useState<string | null>(null);
  const [err, setErr] = useState("");
  async function look(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setBal(null);
    const address = String(new FormData(e.currentTarget).get("address"));
    const res = await fetch(`/api/dlt/cbdc/balance?address=${address}`);
    if (!res.ok) { setErr("Lookup failed"); return; }
    setBal((await res.json()).balance);
  }
  return (
    <Card className="p-4 bg-card/80 border-border md:col-span-2">
      <h2 className="font-mono text-sm mb-3">Balance lookup</h2>
      <form onSubmit={look} className="flex gap-2 items-end">
        <div className="flex-1 space-y-2"><Label htmlFor="address">Address</Label><Input id="address" name="address" required /></div>
        <Button type="submit">Lookup</Button>
      </form>
      {err && <p role="alert" className="text-sm text-destructive mt-2">{err}</p>}
      {bal != null && <p className="mt-3 tabular text-lg">{bal} <span className="text-sm text-muted-foreground">IDR</span></p>}
    </Card>
  );
}
