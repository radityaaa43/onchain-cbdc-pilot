"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { OperationStatus } from "@/components/app/operation-status";
import { toast } from "sonner";

export function SarActions() {
  const [opId, setOpId] = useState<string | null>(null);

  async function generate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const entity = String(new FormData(e.currentTarget).get("entity"));
    const res = await fetch("/api/dlt/reporting/sar", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ entity }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error("Failed: " + JSON.stringify(data.error)); return; }
    setOpId(data.operationId);
    toast.success("SAR submitted");
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Generate SAR</h2>
        <form onSubmit={generate} className="space-y-3">
          <div className="space-y-2"><Label>Entity address</Label><Input name="entity" required /></div>
          <Button type="submit" variant="destructive">Generate SAR</Button>
          {opId && <p className="text-sm mt-2">Status: <OperationStatus operationId={opId} /></p>}
        </form>
      </Card>

      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">About SAR</h2>
        <p className="text-xs text-muted-foreground">
          A Suspicious Activity Report records an entity on-chain via <code>ReportingService.generateSAR</code>.
          The returned <code>reportId</code> (bytes32) is the on-chain record reference.
          SAR generation requires <code>compliance.manage</code> permission.
        </p>
      </Card>
    </div>
  );
}
