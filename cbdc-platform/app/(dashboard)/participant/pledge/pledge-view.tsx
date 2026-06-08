"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const PLEDGE_STATUS: Record<number, string> = { 0: "Active", 1: "Released", 2: "Enforced" };

interface PledgeDetail {
  pledgeId: string; bondId: string; pledgor: string; pledgee: string;
  amount: string; expiryDate: string; status: number;
}

export function PledgeView() {
  const [detail, setDetail] = useState<PledgeDetail | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const pledgeId = String(new FormData(e.currentTarget).get("pledgeId"));
    setLoading(true);
    try {
      const res = await fetch(`/api/dlt/pledge?pledgeId=${encodeURIComponent(pledgeId)}`);
      if (!res.ok) { toast.error("Lookup failed"); return; }
      setDetail(await res.json());
    } finally { setLoading(false); }
  }

  async function action(actionName: string) {
    if (!detail) return;
    const key = crypto.randomUUID();
    setLoading(true);
    try {
      const res = await fetch("/api/dlt/pledge", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({ action: actionName, pledgeId: detail.pledgeId }),
      });
      if (!res.ok) { toast.error("Action failed"); return; }
      toast.success(`${actionName} submitted`);
    } finally { setLoading(false); }
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const key = crypto.randomUUID();
    setLoading(true);
    try {
      const res = await fetch("/api/dlt/pledge", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({
          action:     "create",
          bondId:     String(f.get("bondId")),
          pledgor:    String(f.get("pledgor")),
          pledgee:    String(f.get("pledgee")),
          amount:     Number(f.get("amount")),
          expiryDate: Number(f.get("expiryDate")),
        }),
      });
      if (!res.ok) { toast.error("Create failed"); return; }
      const data = await res.json();
      toast.success(`Pledge created — operation ${data.operationId}`);
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Lookup Pledge</h2>
        <form onSubmit={lookup} className="flex gap-3 items-end">
          <div className="space-y-2 flex-1"><Label htmlFor="pledgeId">Pledge ID (bytes32)</Label><Input id="pledgeId" name="pledgeId" required placeholder="0x..." /></div>
          <Button type="submit" disabled={loading}>Lookup</Button>
        </form>
        {detail && (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Status</dt>
            <dd className={detail.status === 0 ? "text-emerald-400" : "text-muted-foreground"}>{PLEDGE_STATUS[detail.status] ?? detail.status}</dd>
            <dt className="text-muted-foreground">Pledgor</dt><dd className="font-mono text-xs truncate">{detail.pledgor}</dd>
            <dt className="text-muted-foreground">Pledgee</dt><dd className="font-mono text-xs truncate">{detail.pledgee}</dd>
            <dt className="text-muted-foreground">Amount</dt><dd>{detail.amount}</dd>
            <dt className="text-muted-foreground">Expiry</dt><dd>{new Date(Number(detail.expiryDate) * 1000).toLocaleDateString()}</dd>
          </dl>
        )}
        {detail && detail.status === 0 && (
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" disabled={loading} onClick={() => action("release")}>Release</Button>
            <Button size="sm" variant="destructive" disabled={loading} onClick={() => action("enforce")}>Enforce</Button>
          </div>
        )}
      </Card>

      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Create Pledge</h2>
        <form onSubmit={create} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-2"><Label>Bond ID</Label><Input name="bondId" required placeholder="0x..." /></div>
          <div className="space-y-2"><Label>Pledgor</Label><Input name="pledgor" required placeholder="0x..." /></div>
          <div className="space-y-2"><Label>Pledgee</Label><Input name="pledgee" required placeholder="0x..." /></div>
          <div className="space-y-2"><Label>Amount</Label><Input name="amount" type="number" min={1} required /></div>
          <div className="space-y-2"><Label>Expiry (unix timestamp)</Label><Input name="expiryDate" type="number" min={0} required /></div>
          <div className="col-span-2"><Button type="submit" disabled={loading}>Create Pledge</Button></div>
        </form>
      </Card>
    </div>
  );
}
