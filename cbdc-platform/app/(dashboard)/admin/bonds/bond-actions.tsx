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
    setOpId(data.operationId);
    toast.success("Submitted");
  }
  return { opId, run };
}

export function BondActions({ bonds }: { bonds: { bondId: string; name: string }[] }) {
  const coupon = useOp();
  const maturity = useOp();
  const issue = useOp();
  const transfer = useOp();

  const BondSelect = ({ name }: { name: string }) => (
    <select name={name} className="w-full h-10 rounded-md bg-muted border border-border px-3 text-sm">
      {bonds.map((b) => (
        <option key={b.bondId} value={b.bondId}>{b.name} · {b.bondId.slice(0, 10)}…</option>
      ))}
    </select>
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Coupon</h2>
        <form
          onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); coupon.run("/api/dlt/bonds/coupon", { action: "pay-batch", bondId: f.get("bondId") }); }}
          className="space-y-3"
        >
          <div className="space-y-2"><Label>Bond</Label><BondSelect name="bondId" /></div>
          <Button type="submit" className="glow-primary">Pay coupon (batch)</Button>
          {coupon.opId && <p className="text-sm mt-2">Status: <OperationStatus operationId={coupon.opId} /></p>}
        </form>
      </Card>
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Maturity</h2>
        <form
          onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); maturity.run("/api/dlt/bonds/maturity", { action: "trigger", bondId: f.get("bondId") }); }}
          className="space-y-3"
        >
          <div className="space-y-2"><Label>Bond</Label><BondSelect name="bondId" /></div>
          <Button type="submit">Trigger maturity</Button>
          {maturity.opId && <p className="text-sm mt-2">Status: <OperationStatus operationId={maturity.opId} /></p>}
        </form>
      </Card>
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Direct issue</h2>
        <form
          onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); issue.run("/api/dlt/bonds/issue", { bondId: f.get("bondId"), investor: f.get("investor"), amount: Number(f.get("amount")) }); }}
          className="space-y-3"
        >
          <div className="space-y-2"><Label>Bond</Label><BondSelect name="bondId" /></div>
          <div className="space-y-2"><Label htmlFor="investor">Investor</Label><Input id="investor" name="investor" required /></div>
          <div className="space-y-2"><Label htmlFor="iamount">Amount</Label><MoneyInput id="iamount" name="amount" required /></div>
          <Button type="submit">Issue</Button>
          {issue.opId && <p className="text-sm mt-2">Status: <OperationStatus operationId={issue.opId} /></p>}
        </form>
      </Card>
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Transfer</h2>
        <form
          onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); transfer.run("/api/dlt/bonds/transfer", { bondId: f.get("bondId"), from: f.get("from"), to: f.get("to"), amount: Number(f.get("amount")) }); }}
          className="space-y-3"
        >
          <div className="space-y-2"><Label>Bond</Label><BondSelect name="bondId" /></div>
          <div className="space-y-2"><Label htmlFor="from">From</Label><Input id="from" name="from" required /></div>
          <div className="space-y-2"><Label htmlFor="to">To</Label><Input id="to" name="to" required /></div>
          <div className="space-y-2"><Label htmlFor="tamount">Amount</Label><MoneyInput id="tamount" name="amount" required /></div>
          <Button type="submit">Transfer</Button>
          {transfer.opId && <p className="text-sm mt-2">Status: <OperationStatus operationId={transfer.opId} /></p>}
        </form>
      </Card>
    </div>
  );
}
