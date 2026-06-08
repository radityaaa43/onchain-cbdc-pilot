"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/app/money-input";
import { OperationStatus } from "@/components/app/operation-status";
import { toast } from "sonner";

function useShariahOp() {
  const [opId, setOpId] = useState<string | null>(null);
  async function run(body: unknown) {
    const res = await fetch("/api/dlt/compliance/shariah", {
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

export function ShariahActions() {
  const approve  = useShariahOp();
  const certify  = useShariahOp();
  const event    = useShariahOp();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Approve Sukuk</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            approve.run({ action: "approve-sukuk", bondId: f.get("bondId"), shariahBoard: f.get("shariahBoard") });
          }}
          className="space-y-3"
        >
          <div className="space-y-2"><Label>Bond ID (bytes32)</Label><Input name="bondId" required /></div>
          <div className="space-y-2"><Label>Shariah Board address</Label><Input name="shariahBoard" required /></div>
          <Button type="submit">Approve</Button>
          {approve.opId && <p className="text-sm mt-2">Status: <OperationStatus operationId={approve.opId} /></p>}
        </form>
      </Card>

      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Certify Profit Distribution</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            certify.run({ action: "certify-profit", bondId: f.get("bondId"), totalProfit: Number(f.get("totalProfit")), investorShare: Number(f.get("investorShare")) });
          }}
          className="space-y-3"
        >
          <div className="space-y-2"><Label>Bond ID (bytes32)</Label><Input name="bondId" required /></div>
          <div className="space-y-2"><Label>Total Profit</Label><MoneyInput name="totalProfit" required /></div>
          <div className="space-y-2"><Label>Investor Share</Label><MoneyInput name="investorShare" required /></div>
          <Button type="submit">Certify</Button>
          {certify.opId && <p className="text-sm mt-2">Status: <OperationStatus operationId={certify.opId} /></p>}
        </form>
      </Card>

      <Card className="p-4 bg-card/80 border-border md:col-span-2">
        <h2 className="font-mono text-sm mb-3">Record Shariah Event</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            event.run({ action: "event", bondId: f.get("bondId"), eventType: f.get("eventType") });
          }}
          className="flex flex-wrap gap-3 items-end"
        >
          <div className="space-y-2 flex-1 min-w-40"><Label>Bond ID (bytes32)</Label><Input name="bondId" required /></div>
          <div className="space-y-2 w-48">
            <Label>Event Type</Label>
            <select name="eventType" className="w-full h-10 rounded-md bg-muted border border-border px-3 text-sm">
              <option value="PROFIT_DISTRIBUTION">PROFIT_DISTRIBUTION</option>
              <option value="AUDIT">AUDIT</option>
              <option value="REVIEW">REVIEW</option>
            </select>
          </div>
          <Button type="submit">Record Event</Button>
          {event.opId && <p className="text-sm mt-2 w-full">Status: <OperationStatus operationId={event.opId} /></p>}
        </form>
      </Card>
    </div>
  );
}
