"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { OperationStatus } from "@/components/app/operation-status";
import { toast } from "sonner";

function usePolicyOp() {
  const [opId, setOpId] = useState<string | null>(null);
  async function run(body: unknown) {
    const res = await fetch("/api/dlt/compliance/policy", {
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

export function PolicyActions() {
  const addRule    = usePolicyOp();
  const removeRule = usePolicyOp();
  const setDefault = usePolicyOp();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Add Policy Rule</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            addRule.run({ action: "add-rule", ruleId: f.get("ruleId"), ruleContract: f.get("ruleContract") });
          }}
          className="space-y-3"
        >
          <div className="space-y-2"><Label>Rule ID (bytes32)</Label><Input name="ruleId" required /></div>
          <div className="space-y-2"><Label>Rule contract address</Label><Input name="ruleContract" required /></div>
          <Button type="submit">Add Rule</Button>
          {addRule.opId && <p className="text-sm mt-2">Status: <OperationStatus operationId={addRule.opId} /></p>}
        </form>
      </Card>

      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Remove Policy Rule</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            removeRule.run({ action: "remove-rule", ruleId: f.get("ruleId") });
          }}
          className="space-y-3"
        >
          <div className="space-y-2"><Label>Rule ID (bytes32)</Label><Input name="ruleId" required /></div>
          <Button type="submit" variant="destructive">Remove Rule</Button>
          {removeRule.opId && <p className="text-sm mt-2">Status: <OperationStatus operationId={removeRule.opId} /></p>}
        </form>
      </Card>

      <Card className="p-4 bg-card/80 border-border md:col-span-2">
        <h2 className="font-mono text-sm mb-3">Set Default Policy Contract</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setDefault.run({ action: "set-default", policyAddress: f.get("policyAddress") });
          }}
          className="flex gap-3 items-end"
        >
          <div className="space-y-2 flex-1"><Label>Policy contract address</Label><Input name="policyAddress" required /></div>
          <Button type="submit">Set Default</Button>
          {setDefault.opId && <p className="text-sm mt-2 w-full">Status: <OperationStatus operationId={setDefault.opId} /></p>}
        </form>
      </Card>
    </div>
  );
}
