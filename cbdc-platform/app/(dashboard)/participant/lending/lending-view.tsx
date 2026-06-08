"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const LEND_STATUS: Record<number, string> = { 0: "Active", 1: "Returned", 2: "Recalled", 3: "Defaulted" };

interface LendDetail {
  lendId: string; bondId: string; lender: string; borrower: string;
  amount: string; lendingFeeRateBps: string; collateralAmount: string;
  tenor: string; status: number;
}

export function LendingView() {
  const [detail, setDetail] = useState<LendDetail | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const lendId = String(new FormData(e.currentTarget).get("lendId"));
    setLoading(true);
    try {
      const res = await fetch(`/api/dlt/lending?lendId=${encodeURIComponent(lendId)}`);
      if (!res.ok) { toast.error("Lookup failed"); return; }
      setDetail(await res.json());
    } finally { setLoading(false); }
  }

  async function action(actionName: string) {
    if (!detail) return;
    const key = crypto.randomUUID();
    setLoading(true);
    try {
      const res = await fetch("/api/dlt/lending", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({ action: actionName, lendId: detail.lendId }),
      });
      if (!res.ok) { toast.error("Action failed"); return; }
      toast.success(`${actionName} submitted`);
    } finally { setLoading(false); }
  }

  async function initiate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const key = crypto.randomUUID();
    setLoading(true);
    try {
      const res = await fetch("/api/dlt/lending", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({
          action:    "initiate",
          bondId:    String(f.get("bondId")),
          lender:    String(f.get("lender")),
          borrower:  String(f.get("borrower")),
          amount:    Number(f.get("amount")),
          feeRateBps: Number(f.get("feeRateBps")),
          tenor:     Number(f.get("tenor")),
        }),
      });
      if (!res.ok) { toast.error("Initiate failed"); return; }
      const data = await res.json();
      toast.success(`Lending initiated — operation ${data.operationId}`);
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Lookup Agreement</h2>
        <form onSubmit={lookup} className="flex gap-3 items-end">
          <div className="space-y-2 flex-1"><Label htmlFor="lendId">Lend ID (bytes32)</Label><Input id="lendId" name="lendId" required placeholder="0x..." /></div>
          <Button type="submit" disabled={loading}>Lookup</Button>
        </form>
        {detail && (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Status</dt>
            <dd className={detail.status === 0 ? "text-emerald-400" : "text-muted-foreground"}>{LEND_STATUS[detail.status] ?? detail.status}</dd>
            <dt className="text-muted-foreground">Lender</dt><dd className="font-mono text-xs truncate">{detail.lender}</dd>
            <dt className="text-muted-foreground">Borrower</dt><dd className="font-mono text-xs truncate">{detail.borrower}</dd>
            <dt className="text-muted-foreground">Amount</dt><dd>{detail.amount}</dd>
            <dt className="text-muted-foreground">Fee (bps)</dt><dd>{detail.lendingFeeRateBps}</dd>
            <dt className="text-muted-foreground">Collateral</dt><dd>{detail.collateralAmount}</dd>
          </dl>
        )}
        {detail && detail.status === 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={loading} onClick={() => action("return")}>Return</Button>
            <Button size="sm" variant="outline" disabled={loading} onClick={() => action("recall")}>Recall</Button>
            <Button size="sm" variant="destructive" disabled={loading} onClick={() => action("default")}>Mark Default</Button>
          </div>
        )}
      </Card>

      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Initiate Lending</h2>
        <form onSubmit={initiate} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-2"><Label>Bond ID</Label><Input name="bondId" required placeholder="0x..." /></div>
          <div className="space-y-2"><Label>Lender</Label><Input name="lender" required placeholder="0x..." /></div>
          <div className="space-y-2"><Label>Borrower</Label><Input name="borrower" required placeholder="0x..." /></div>
          <div className="space-y-2"><Label>Amount</Label><Input name="amount" type="number" min={1} required /></div>
          <div className="space-y-2"><Label>Fee Rate (bps)</Label><Input name="feeRateBps" type="number" min={0} required /></div>
          <div className="space-y-2"><Label>Tenor (days)</Label><Input name="tenor" type="number" min={1} required /></div>
          <div className="col-span-2"><Button type="submit" disabled={loading}>Initiate</Button></div>
        </form>
      </Card>
    </div>
  );
}
