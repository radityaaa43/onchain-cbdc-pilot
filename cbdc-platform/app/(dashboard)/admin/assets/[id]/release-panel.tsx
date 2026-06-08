"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export function ReleasePanel({ id, status, isCash }: { id: string; status: string; isCash: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (status !== "CREATED") return <p className="text-sm text-muted-foreground">Status is {status} — release already done.</p>;

  async function release(body: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch(`/api/dlt/assets/${id}/release`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(body),
    });
    setBusy(false);
    const data = await res.json();
    if (!res.ok) {
      toast.error("Release failed: " + JSON.stringify(data.error));
      return;
    }
    toast.success(isCash ? "Cash released (issuing)" : "Published to auction");
    router.push(isCash ? "/admin/assets" : `/admin/auction/${data.auctionId}`);
  }

  if (isCash)
    return (
      <Card className="p-4 bg-card/80 border-border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            release({ to: fd.get("to"), amount: Number(fd.get("amount")) });
          }}
          className="space-y-3"
        >
          <div className="space-y-2">
            <Label htmlFor="to">Issue to (address)</Label>
            <Input id="to" name="to" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" name="amount" type="number" required className="tabular" />
          </div>
          <Button type="submit" disabled={busy} className="glow-primary">
            {busy ? "Releasing…" : "Release (issue CBDC)"}
          </Button>
        </form>
      </Card>
    );
  return (
    <Button disabled={busy} onClick={() => release({})} className="glow-primary">
      {busy ? "Publishing…" : "Publish to auction"}
    </Button>
  );
}
