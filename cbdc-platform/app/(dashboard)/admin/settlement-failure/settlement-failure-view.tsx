"use client";
import { Fragment, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const REASON: Record<number, string> = { 0: "Unknown", 1: "InsufficientBonds", 2: "InsufficientCBDC", 3: "Timeout" };

interface FailureRecord { settlementId: string; reason: number; details: string; timestamp: string; resolved: boolean; }
interface BuyInRecord   { initiated: boolean; executed: boolean; initiatedAt: string; buyInAmount: string; buyInPriceBps: string; }

export function SettlementFailureView({ mode }: { mode: "operator" | "participant" }) {
  const [failure, setFailure] = useState<FailureRecord | null>(null);
  const [buyIn, setBuyIn]     = useState<BuyInRecord | null>(null);
  const [settlId, setSettlId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const id = String(new FormData(e.currentTarget).get("settlementId"));
    setSettlId(id);
    setLoading(true);
    try {
      const [fRes, bRes] = await Promise.all([
        fetch(`/api/dlt/settlement-failure?settlementId=${encodeURIComponent(id)}`),
        fetch(`/api/dlt/settlement-failure?settlementId=${encodeURIComponent(id)}&type=buy-in`),
      ]);
      if (!fRes.ok) { toast.error("Not found"); return; }
      const fd = await fRes.json();
      setFailure(fd.failure ?? fd);
      if (bRes.ok) { const bd = await bRes.json(); setBuyIn(bd.buyIn ?? bd); }
    } finally { setLoading(false); }
  }

  async function action(act: string, extra?: Record<string, unknown>) {
    if (!settlId) return;
    const key = crypto.randomUUID();
    setLoading(true);
    try {
      const res = await fetch("/api/dlt/settlement-failure", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({ action: act, settlementId: settlId, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed"); return; }
      toast.success(`${act} submitted — op ${data.operationId}`);
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Lookup Settlement Failure</h2>
        <form onSubmit={lookup} className="flex gap-3 items-end">
          <div className="space-y-2 flex-1"><Label>Settlement ID (bytes32)</Label><Input name="settlementId" required placeholder="0x..." /></div>
          <Button type="submit" disabled={loading}>Lookup</Button>
        </form>
        {failure && (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Reason</dt><dd>{REASON[failure.reason] ?? failure.reason}</dd>
            <dt className="text-muted-foreground">Details</dt><dd>{failure.details}</dd>
            <dt className="text-muted-foreground">Timestamp</dt><dd>{new Date(Number(failure.timestamp) * 1000).toLocaleString()}</dd>
            <dt className="text-muted-foreground">Resolved</dt><dd className={failure.resolved ? "text-emerald-400" : "text-destructive"}>{failure.resolved ? "Yes" : "No"}</dd>
          </dl>
        )}
        {failure && !failure.resolved && mode === "operator" && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={loading} onClick={() => action("retry")}>Retry</Button>
            <Button size="sm" variant="outline" disabled={loading} onClick={() => action("escalate")}>Escalate</Button>
            <Button size="sm" variant="outline" disabled={loading} onClick={() => action("buy-in-initiate")}>Initiate Buy-In</Button>
          </div>
        )}
      </Card>

      {buyIn && (
        <Card className="p-4 bg-card/80 border-border">
          <h2 className="font-mono text-sm mb-3">Buy-In Status</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Initiated</dt><dd>{buyIn.initiated ? "Yes" : "No"}</dd>
            <dt className="text-muted-foreground">Executed</dt><dd>{buyIn.executed ? "Yes" : "No"}</dd>
            <dt className="text-muted-foreground">Amount</dt><dd>{buyIn.buyInAmount}</dd>
            <dt className="text-muted-foreground">Price (bps)</dt><dd>{buyIn.buyInPriceBps}</dd>
          </dl>
          {buyIn.initiated && !buyIn.executed && mode === "operator" && (
            <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); action("buy-in-execute", { buyInAmount: Number(f.get("buyInAmount")), buyInPriceBps: Number(f.get("buyInPriceBps")) }); }} className="mt-3 grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Buy-In Amount</Label><Input name="buyInAmount" type="number" min={1} required /></div>
              <div className="space-y-2"><Label>Price (bps)</Label><Input name="buyInPriceBps" type="number" min={1} required /></div>
              <div className="col-span-2"><Button type="submit" disabled={loading}>Execute Buy-In</Button></div>
            </form>
          )}
        </Card>
      )}

      {mode === "operator" && (
        <Card className="p-4 bg-card/80 border-border">
          <h2 className="font-mono text-sm mb-3">Report Failure</h2>
          <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); action("report", { reason: Number(f.get("reason")), details: String(f.get("details")) }); }} className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-2"><Label>Settlement ID</Label><Input name="sfSettlId" required placeholder="0x..." onChange={(e) => setSettlId(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <select name="reason" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                <option value={0}>Unknown</option>
                <option value={1}>InsufficientBonds</option>
                <option value={2}>InsufficientCBDC</option>
                <option value={3}>Timeout</option>
              </select>
            </div>
            <div className="space-y-2"><Label>Details</Label><Input name="details" /></div>
            <div className="col-span-2"><Button type="submit" disabled={loading}>Report</Button></div>
          </form>
        </Card>
      )}
    </div>
  );
}
