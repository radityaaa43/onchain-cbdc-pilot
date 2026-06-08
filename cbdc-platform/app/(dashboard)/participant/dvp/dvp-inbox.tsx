"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function DvpInbox({ canInitiate }: { canInitiate: boolean }) {
  const [status, setStatus] = useState<unknown>(null);
  const [err, setErr] = useState("");
  async function look(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr("");
    const id = String(new FormData(e.currentTarget).get("id"));
    const res = await fetch(`/api/dlt/dvp/${id}`);
    if (!res.ok) { setErr("Lookup failed"); return; }
    setStatus((await res.json()).settlement);
  }
  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Settlement status</h2>
        <form onSubmit={look} className="flex gap-2 items-end">
          <div className="flex-1 space-y-2"><Label htmlFor="id">Settlement ID</Label><Input id="id" name="id" required /></div>
          <Button type="submit">Lookup</Button>
        </form>
        {err && <p role="alert" className="text-sm text-destructive mt-2">{err}</p>}
        {status != null && (
          <>
            <pre className="mt-3 text-xs tabular bg-muted p-3 rounded-md overflow-auto">{JSON.stringify(status, null, 2)}</pre>
            <div className="mt-3 flex items-center gap-2">
              <Button disabled title="Affirm requires a DLT API endpoint not yet available" variant="secondary">Affirm</Button>
              <span className="text-xs text-warning">Affirm/confirm not available — DLT API lacks an affirm endpoint (roadmap).</span>
            </div>
          </>
        )}
      </Card>
      {canInitiate && <InitiateForm onDone={() => toast.success("DVP initiated")} />}
    </div>
  );
}

function InitiateForm({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const n = (k: string) => Number(f.get(k));
    const body = {
      bondId: f.get("bondId"), bondSeller: f.get("bondSeller"), bondBuyer: f.get("bondBuyer"),
      bondAmount: n("bondAmount"), bondPartition: f.get("bondPartition"),
      cbdcPayer: f.get("cbdcPayer"), cbdcPayee: f.get("cbdcPayee"), cbdcAmount: n("cbdcAmount"), model: n("model"),
    };
    setBusy(true);
    const res = await fetch("/api/dlt/dvp", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { toast.error("Initiate failed: " + JSON.stringify((await res.json()).error)); return; }
    onDone();
  }
  return (
    <Card className="p-4 bg-card/80 border-border">
      <h2 className="font-mono text-sm mb-3">Initiate DVP (trader)</h2>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        {["bondId","bondPartition","bondSeller","bondBuyer","cbdcPayer","cbdcPayee"].map((k) => (
          <div key={k} className="space-y-2"><Label htmlFor={k}>{k}</Label><Input id={k} name={k} required /></div>
        ))}
        <div className="space-y-2"><Label htmlFor="bondAmount">bondAmount</Label><Input id="bondAmount" name="bondAmount" type="number" required className="tabular" /></div>
        <div className="space-y-2"><Label htmlFor="cbdcAmount">cbdcAmount</Label><Input id="cbdcAmount" name="cbdcAmount" type="number" required className="tabular" /></div>
        <div className="space-y-2"><Label htmlFor="model">model (0-2)</Label><Input id="model" name="model" type="number" defaultValue="0" required className="tabular" /></div>
        <div className="col-span-2"><Button type="submit" disabled={busy} className="glow-primary">{busy ? "Initiating…" : "Initiate"}</Button></div>
      </form>
    </Card>
  );
}
