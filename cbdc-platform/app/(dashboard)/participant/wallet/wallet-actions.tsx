"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    setOpId(data.operationId); toast.success("Submitted");
  }
  return { opId, run };
}

export function WalletActions() {
  const transfer = useOp();
  const approve = useOp();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Transfer CBDC</h2>
        <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); transfer.run("/api/dlt/participant/transfer", { to: f.get("to"), amount: Number(f.get("amount")) }); }} className="space-y-3">
          <div className="space-y-2"><Label htmlFor="to">To address</Label><Input id="to" name="to" required /></div>
          <div className="space-y-2"><Label htmlFor="amount">Amount</Label><MoneyInput id="amount" name="amount" required /></div>
          <Button type="submit" className="glow-primary">Send</Button>
          {transfer.opId && <p className="text-sm mt-2">Status: <OperationStatus operationId={transfer.opId} /></p>}
        </form>
      </Card>
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Approve spender (e.g. DVPService)</h2>
        <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); approve.run("/api/dlt/participant/approve", { spender: f.get("spender"), amount: Number(f.get("amount")) }); }} className="space-y-3">
          <div className="space-y-2"><Label htmlFor="spender">Spender address</Label><Input id="spender" name="spender" required /></div>
          <div className="space-y-2"><Label htmlFor="aamount">Amount</Label><MoneyInput id="aamount" name="amount" required /></div>
          <Button type="submit">Approve</Button>
          {approve.opId && <p className="text-sm mt-2">Status: <OperationStatus operationId={approve.opId} /></p>}
        </form>
      </Card>
    </div>
  );
}
