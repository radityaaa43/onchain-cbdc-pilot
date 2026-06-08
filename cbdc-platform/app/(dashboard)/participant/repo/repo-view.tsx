"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const REPO_STATUS: Record<number, string> = { 0: "Active", 1: "Unwound", 2: "EarlyTerminated", 3: "Defaulted" };

interface RepoDetail {
  repoId: string; bondId: string; seller: string; buyer: string;
  amount: string; repoRate: string; tenor: string; startDate: string; endDate: string;
  status: number; sellerConsentEarlyTermination: boolean; buyerConsentEarlyTermination: boolean;
  marginCallActive: boolean;
}

export function RepoView() {
  const [detail, setDetail] = useState<RepoDetail | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const repoId = String(new FormData(e.currentTarget).get("repoId"));
    setLoading(true);
    try {
      const res = await fetch(`/api/dlt/repo?repoId=${encodeURIComponent(repoId)}`);
      if (!res.ok) { toast.error("Lookup failed"); return; }
      setDetail(await res.json());
    } finally { setLoading(false); }
  }

  async function action(actionName: string, extraBody?: Record<string, unknown>) {
    if (!detail) return;
    const key = crypto.randomUUID();
    setLoading(true);
    try {
      const res = await fetch("/api/dlt/repo", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({ action: actionName, repoId: detail.repoId, ...extraBody }),
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
      const res = await fetch("/api/dlt/repo", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({
          action: "initiate",
          bondId:   String(f.get("bondId")),
          seller:   String(f.get("seller")),
          buyer:    String(f.get("buyer")),
          amount:   Number(f.get("amount")),
          repoRate: Number(f.get("repoRate")),
          tenor:    Number(f.get("tenor")),
        }),
      });
      if (!res.ok) { toast.error("Initiate failed"); return; }
      const data = await res.json();
      toast.success(`Repo initiated — operation ${data.operationId}`);
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Lookup Repo</h2>
        <form onSubmit={lookup} className="flex gap-3 items-end">
          <div className="space-y-2 flex-1"><Label htmlFor="repoId">Repo ID (bytes32)</Label><Input id="repoId" name="repoId" required placeholder="0x..." /></div>
          <Button type="submit" disabled={loading}>Lookup</Button>
        </form>
        {detail && (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Status</dt>
            <dd className={detail.status === 0 ? "text-emerald-400" : "text-muted-foreground"}>{REPO_STATUS[detail.status] ?? detail.status}</dd>
            <dt className="text-muted-foreground">Seller</dt><dd className="font-mono text-xs truncate">{detail.seller}</dd>
            <dt className="text-muted-foreground">Buyer</dt><dd className="font-mono text-xs truncate">{detail.buyer}</dd>
            <dt className="text-muted-foreground">Amount</dt><dd>{detail.amount}</dd>
            <dt className="text-muted-foreground">Rate (bps)</dt><dd>{detail.repoRate}</dd>
            <dt className="text-muted-foreground">Tenor (days)</dt><dd>{detail.tenor}</dd>
            <dt className="text-muted-foreground">Margin call</dt><dd>{detail.marginCallActive ? "Active" : "None"}</dd>
          </dl>
        )}
        {detail && detail.status === 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={loading} onClick={() => action("consent-early-termination")}>Consent Early Term</Button>
            <Button size="sm" variant="outline" disabled={loading} onClick={() => action("terminate-early")}>Terminate Early</Button>
            <Button size="sm" variant="outline" disabled={loading} onClick={() => action("unwind")}>Unwind</Button>
          </div>
        )}
      </Card>

      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Initiate Repo</h2>
        <form onSubmit={initiate} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-2"><Label>Bond ID</Label><Input name="bondId" required placeholder="0x..." /></div>
          <div className="space-y-2"><Label>Seller</Label><Input name="seller" required placeholder="0x..." /></div>
          <div className="space-y-2"><Label>Buyer</Label><Input name="buyer" required placeholder="0x..." /></div>
          <div className="space-y-2"><Label>Amount</Label><Input name="amount" type="number" min={1} required /></div>
          <div className="space-y-2"><Label>Rate (bps)</Label><Input name="repoRate" type="number" min={0} required /></div>
          <div className="space-y-2"><Label>Tenor (days)</Label><Input name="tenor" type="number" min={1} required /></div>
          <div className="col-span-2"><Button type="submit" disabled={loading}>Initiate</Button></div>
        </form>
      </Card>
    </div>
  );
}
