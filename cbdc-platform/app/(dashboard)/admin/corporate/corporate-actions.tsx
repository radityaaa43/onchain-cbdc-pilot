"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Tab = "call-put" | "restructuring" | "tender" | "consent";

export function CorporateActionsView() {
  const [tab, setTab] = useState<Tab>("call-put");
  const [loading, setLoading] = useState(false);

  async function submit(action: string, body: Record<string, unknown>) {
    const key = crypto.randomUUID();
    setLoading(true);
    try {
      const res = await fetch("/api/dlt/corporate-action", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Action failed"); return; }
      toast.success(`${action} submitted — op ${data.operationId}`);
    } finally { setLoading(false); }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "call-put", label: "Call / Put" },
    { key: "restructuring", label: "Restructuring" },
    { key: "tender", label: "Tender" },
    { key: "consent", label: "Consent" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-border pb-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "call-put" && (
        <div className="space-y-4">
          <Card className="p-4 bg-card/80 border-border">
            <h2 className="font-mono text-sm mb-3">Schedule Call Option</h2>
            <form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await submit("schedule-call-option", { bondId: String(f.get("bondId")), callDate: Number(f.get("callDate")), callPriceBps: Number(f.get("callPriceBps")) }); }} className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-2"><Label>Bond ID</Label><Input name="bondId" required placeholder="0x..." /></div>
              <div className="space-y-2"><Label>Call Date (unix)</Label><Input name="callDate" type="number" min={0} required /></div>
              <div className="space-y-2"><Label>Call Price (bps)</Label><Input name="callPriceBps" type="number" min={1} required /></div>
              <div className="col-span-2"><Button type="submit" disabled={loading}>Schedule</Button></div>
            </form>
          </Card>
          <Card className="p-4 bg-card/80 border-border">
            <h2 className="font-mono text-sm mb-3">Execute Call Batch</h2>
            <form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await submit("execute-call-batch", { bondId: String(f.get("bondId")) }); }} className="flex gap-3 items-end">
              <div className="space-y-2 flex-1"><Label>Bond ID</Label><Input name="bondId" required placeholder="0x..." /></div>
              <Button type="submit" disabled={loading}>Execute</Button>
            </form>
          </Card>
          <Card className="p-4 bg-card/80 border-border">
            <h2 className="font-mono text-sm mb-3">Register Put Option</h2>
            <form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await submit("register-put-option", { bondId: String(f.get("bondId")), putDate: Number(f.get("putDate")), putPriceBps: Number(f.get("putPriceBps")) }); }} className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-2"><Label>Bond ID</Label><Input name="bondId" required placeholder="0x..." /></div>
              <div className="space-y-2"><Label>Put Date (unix)</Label><Input name="putDate" type="number" min={0} required /></div>
              <div className="space-y-2"><Label>Put Price (bps)</Label><Input name="putPriceBps" type="number" min={1} required /></div>
              <div className="col-span-2"><Button type="submit" disabled={loading}>Register</Button></div>
            </form>
          </Card>
        </div>
      )}

      {tab === "restructuring" && (
        <div className="space-y-4">
          <Card className="p-4 bg-card/80 border-border">
            <h2 className="font-mono text-sm mb-3">Propose Restructuring</h2>
            <form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await submit("propose-restructuring", { bondId: String(f.get("bondId")), newCouponRateBps: Number(f.get("newCouponRateBps")), newMaturityExtDays: Number(f.get("newMaturityExtDays")) }); }} className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-2"><Label>Bond ID</Label><Input name="bondId" required placeholder="0x..." /></div>
              <div className="space-y-2"><Label>New Coupon Rate (bps)</Label><Input name="newCouponRateBps" type="number" min={0} required /></div>
              <div className="space-y-2"><Label>Maturity Extension (days)</Label><Input name="newMaturityExtDays" type="number" min={0} required /></div>
              <div className="col-span-2"><Button type="submit" disabled={loading}>Propose</Button></div>
            </form>
          </Card>
          <Card className="p-4 bg-card/80 border-border">
            <h2 className="font-mono text-sm mb-3">Approve / Execute / Reject Restructuring</h2>
            <div className="space-y-3">
              {(["approve-restructuring", "execute-restructuring", "reject-restructuring"] as const).map((a) => (
                <form key={a} onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await submit(a, { proposalId: String(f.get(`proposalId-${a}`)) }); }} className="flex gap-3 items-end">
                  <div className="space-y-2 flex-1"><Label>{a.replace(/-/g, " ").replace(/^./, c => c.toUpperCase())} — Proposal ID</Label><Input name={`proposalId-${a}`} required placeholder="0x..." /></div>
                  <Button type="submit" disabled={loading} variant={a === "reject-restructuring" ? "destructive" : "default"}>{a.split("-")[0].replace(/^./, c => c.toUpperCase())}</Button>
                </form>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "tender" && (
        <div className="space-y-4">
          <Card className="p-4 bg-card/80 border-border">
            <h2 className="font-mono text-sm mb-3">Schedule Tender Offer</h2>
            <form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await submit("schedule-tender-offer", { bondId: String(f.get("bondId")), openDate: Number(f.get("openDate")), closeDate: Number(f.get("closeDate")), tenderPriceBps: Number(f.get("tenderPriceBps")) }); }} className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-2"><Label>Bond ID</Label><Input name="bondId" required placeholder="0x..." /></div>
              <div className="space-y-2"><Label>Open Date (unix)</Label><Input name="openDate" type="number" min={0} required /></div>
              <div className="space-y-2"><Label>Close Date (unix)</Label><Input name="closeDate" type="number" min={0} required /></div>
              <div className="space-y-2"><Label>Tender Price (bps)</Label><Input name="tenderPriceBps" type="number" min={1} required /></div>
              <div className="col-span-2"><Button type="submit" disabled={loading}>Schedule</Button></div>
            </form>
          </Card>
          <Card className="p-4 bg-card/80 border-border">
            <h2 className="font-mono text-sm mb-3">Close Tender Offer</h2>
            <form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await submit("close-tender-offer", { bondId: String(f.get("bondIdClose")) }); }} className="flex gap-3 items-end">
              <div className="space-y-2 flex-1"><Label>Bond ID</Label><Input name="bondIdClose" required placeholder="0x..." /></div>
              <Button type="submit" disabled={loading}>Close</Button>
            </form>
          </Card>
        </div>
      )}

      {tab === "consent" && (
        <div className="space-y-4">
          <Card className="p-4 bg-card/80 border-border">
            <h2 className="font-mono text-sm mb-3">Propose Consent Solicitation</h2>
            <form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await submit("propose-consent", { bondId: String(f.get("bondId")), description: String(f.get("description")), votingDurationDays: Number(f.get("votingDurationDays")), quorumBps: Number(f.get("quorumBps")) }); }} className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-2"><Label>Bond ID</Label><Input name="bondId" required placeholder="0x..." /></div>
              <div className="col-span-2 space-y-2"><Label>Description</Label><Input name="description" required /></div>
              <div className="space-y-2"><Label>Duration (days)</Label><Input name="votingDurationDays" type="number" min={1} required /></div>
              <div className="space-y-2"><Label>Quorum (bps)</Label><Input name="quorumBps" type="number" min={1} max={10000} required /></div>
              <div className="col-span-2"><Button type="submit" disabled={loading}>Propose</Button></div>
            </form>
          </Card>
          <Card className="p-4 bg-card/80 border-border">
            <h2 className="font-mono text-sm mb-3">Vote / Finalize Consent</h2>
            <form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await submit("vote-consent", { proposalId: String(f.get("proposalId")), inFavor: f.get("inFavor") === "true" }); }} className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-2"><Label>Proposal ID</Label><Input name="proposalId" required placeholder="0x..." /></div>
              <div className="space-y-2">
                <Label>Vote</Label>
                <select name="inFavor" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                  <option value="true">In Favor</option>
                  <option value="false">Against</option>
                </select>
              </div>
              <div className="space-y-2 flex items-end"><Button type="submit" disabled={loading}>Vote</Button></div>
            </form>
            <form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await submit("finalize-consent", { proposalId: String(f.get("finalizeId")) }); }} className="flex gap-3 items-end mt-3">
              <div className="space-y-2 flex-1"><Label>Finalize — Proposal ID</Label><Input name="finalizeId" required placeholder="0x..." /></div>
              <Button type="submit" disabled={loading} variant="outline">Finalize</Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
