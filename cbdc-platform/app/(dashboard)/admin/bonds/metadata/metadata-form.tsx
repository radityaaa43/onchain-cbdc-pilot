"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { OperationStatus } from "@/components/app/operation-status";
import { toast } from "sonner";

const GROUPS = ["static", "terms", "dlt-platform", "credit-events", "ratings", "indonesian"] as const;

export function MetadataForm() {
  const [group, setGroup] = useState<(typeof GROUPS)[number]>("terms");
  const [json, setJson] = useState('{\n  "interestRateBps": 600\n}');
  const [opId, setOpId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    let data: unknown;
    try { data = JSON.parse(json); } catch { toast.error("Invalid JSON"); return; }
    setBusy(true);
    const res = await fetch("/api/dlt/bonds/metadata", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ group, data }),
    });
    setBusy(false);
    const body = await res.json();
    if (!res.ok) { toast.error("Failed: " + JSON.stringify(body.error)); return; }
    setOpId(body.operationId);
    toast.success("Submitted");
  }

  return (
    <Card className="p-4 bg-card/80 border-border max-w-2xl">
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="group">Metadata group</Label>
          <select
            id="group"
            value={group}
            onChange={(e) => setGroup(e.target.value as typeof group)}
            className="w-full h-10 rounded-md bg-muted border border-border px-3 text-sm"
          >
            {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="json">Data (JSON)</Label>
          <textarea
            id="json"
            value={json}
            onChange={(e) => setJson(e.target.value)}
            rows={8}
            className="w-full rounded-md bg-muted border border-border p-3 text-sm font-mono"
          />
        </div>
        <Button type="submit" disabled={busy} className="glow-primary">{busy ? "Submitting…" : "Set metadata"}</Button>
        {opId && <p className="text-sm mt-2">Status: <OperationStatus operationId={opId} /></p>}
      </form>
    </Card>
  );
}
