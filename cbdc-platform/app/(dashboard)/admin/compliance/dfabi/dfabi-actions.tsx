"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { OperationStatus } from "@/components/app/operation-status";
import { toast } from "sonner";

function useOp() {
  const [opId, setOpId] = useState<string | null>(null);
  async function run(body: unknown) {
    const res = await fetch("/api/dlt/compliance/dfabi", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { toast.error("Failed: " + JSON.stringify(data.error)); return; }
    setOpId(data.operationId);
    toast.success("Submitted");
  }
  return { opId, run };
}

export function DfabiActions() {
  const eligible    = useOp();
  const byBond      = useOp();
  const restriction = useOp();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Set Global Eligibility</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            eligible.run({ action: "eligible", participant: f.get("participant"), eligible: f.get("eligible") === "true" });
          }}
          className="space-y-3"
        >
          <div className="space-y-2"><Label>Participant address</Label><Input name="participant" required /></div>
          <div className="space-y-2">
            <Label>Eligible</Label>
            <select name="eligible" className="w-full h-10 rounded-md bg-muted border border-border px-3 text-sm">
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <Button type="submit">Set Eligibility</Button>
          {eligible.opId && <p className="text-sm mt-2">Status: <OperationStatus operationId={eligible.opId} /></p>}
        </form>
      </Card>

      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Set Bond-Specific Eligibility</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            byBond.run({ action: "eligible-by-bond", participant: f.get("participant"), bondId: f.get("bondId"), eligible: f.get("eligible") === "true" });
          }}
          className="space-y-3"
        >
          <div className="space-y-2"><Label>Participant</Label><Input name="participant" required /></div>
          <div className="space-y-2"><Label>Bond ID (bytes32)</Label><Input name="bondId" required /></div>
          <div className="space-y-2">
            <Label>Eligible</Label>
            <select name="eligible" className="w-full h-10 rounded-md bg-muted border border-border px-3 text-sm">
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <Button type="submit">Set Bond Eligibility</Button>
          {byBond.opId && <p className="text-sm mt-2">Status: <OperationStatus operationId={byBond.opId} /></p>}
        </form>
      </Card>

      <Card className="p-4 bg-card/80 border-border md:col-span-2">
        <h2 className="font-mono text-sm mb-3">Set Transfer Restriction</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            restriction.run({ action: "restriction", bondId: f.get("bondId"), restriction: { minAmount: Number(f.get("minAmount")), maxAmount: Number(f.get("maxAmount")) } });
          }}
          className="flex flex-wrap gap-3 items-end"
        >
          <div className="space-y-2 flex-1 min-w-40"><Label>Bond ID</Label><Input name="bondId" required /></div>
          <div className="space-y-2 w-32"><Label>Min Amount</Label><Input name="minAmount" type="number" min={0} required /></div>
          <div className="space-y-2 w-32"><Label>Max Amount</Label><Input name="maxAmount" type="number" min={1} required /></div>
          <Button type="submit">Set Restriction</Button>
          {restriction.opId && <p className="text-sm mt-2 w-full">Status: <OperationStatus operationId={restriction.opId} /></p>}
        </form>
      </Card>
    </div>
  );
}
