"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { OperationStatus } from "@/components/app/operation-status";
import { toast } from "sonner";

function useGeneralOp() {
  const [opId, setOpId] = useState<string | null>(null);
  async function run(body: unknown) {
    const res = await fetch("/api/dlt/compliance/general", {
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

export function AmlActions() {
  const suspend    = useGeneralOp();
  const risk       = useGeneralOp();
  const suspicious = useGeneralOp();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Suspend / Unsuspend Participant</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            suspend.run({ action: "suspend", participant: f.get("participant"), suspended: f.get("suspended") === "true", reason: f.get("reason") });
          }}
          className="space-y-3"
        >
          <div className="space-y-2"><Label>Participant address</Label><Input name="participant" required /></div>
          <div className="space-y-2">
            <Label>Action</Label>
            <select name="suspended" className="w-full h-10 rounded-md bg-muted border border-border px-3 text-sm">
              <option value="true">Suspend</option>
              <option value="false">Unsuspend</option>
            </select>
          </div>
          <div className="space-y-2"><Label>Reason</Label><Input name="reason" required /></div>
          <Button type="submit" variant="destructive">Apply</Button>
          {suspend.opId && <p className="text-sm mt-2">Status: <OperationStatus operationId={suspend.opId} /></p>}
        </form>
      </Card>

      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Set Risk Category</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            risk.run({ action: "risk-category", participant: f.get("participant"), riskCategory: f.get("riskCategory") });
          }}
          className="space-y-3"
        >
          <div className="space-y-2"><Label>Participant address</Label><Input name="participant" required /></div>
          <div className="space-y-2">
            <Label>Risk Category</Label>
            <select name="riskCategory" className="w-full h-10 rounded-md bg-muted border border-border px-3 text-sm">
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
          </div>
          <Button type="submit">Set Risk Category</Button>
          {risk.opId && <p className="text-sm mt-2">Status: <OperationStatus operationId={risk.opId} /></p>}
        </form>
      </Card>

      <Card className="p-4 bg-card/80 border-border md:col-span-2">
        <h2 className="font-mono text-sm mb-3">Report Suspicious Activity</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            suspicious.run({ action: "report-suspicious", entity: f.get("entity"), reason: f.get("reason") });
          }}
          className="flex flex-wrap gap-3 items-end"
        >
          <div className="space-y-2 flex-1 min-w-40"><Label>Entity address</Label><Input name="entity" required /></div>
          <div className="space-y-2 flex-1 min-w-40"><Label>Reason</Label><Input name="reason" required /></div>
          <Button type="submit" variant="destructive">Report</Button>
          {suspicious.opId && <p className="text-sm mt-2 w-full">Status: <OperationStatus operationId={suspicious.opId} /></p>}
        </form>
      </Card>
    </div>
  );
}
