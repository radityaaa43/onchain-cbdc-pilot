"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export function AllocationForm({ auctionId, orgs }: { auctionId: string; orgs: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const res = await fetch(`/api/dlt/auctions/${auctionId}/allocations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orgId: fd.get("orgId"),
        bondAmount: Number(fd.get("bondAmount")),
        price: Number(fd.get("price")),
        cbdcAmount: Number(fd.get("cbdcAmount")),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error("Allocation failed");
      return;
    }
    toast.success("Allocated");
    router.refresh();
  }
  return (
    <Card className="p-4 bg-card/80 border-border">
      <form onSubmit={submit} className="grid grid-cols-2 gap-3 items-end">
        <div className="space-y-2 col-span-2">
          <Label htmlFor="orgId">Winner org</Label>
          <select id="orgId" name="orgId" className="w-full h-10 rounded-md bg-muted border border-border px-3 text-sm">
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bondAmount">Bond amount</Label>
          <Input id="bondAmount" name="bondAmount" type="number" required className="tabular" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">Price (bps)</Label>
          <Input id="price" name="price" type="number" defaultValue="10000" required className="tabular" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cbdcAmount">CBDC amount</Label>
          <Input id="cbdcAmount" name="cbdcAmount" type="number" required className="tabular" />
        </div>
        <Button type="submit" disabled={busy} className="col-span-2">
          {busy ? "Adding…" : "Add allocation"}
        </Button>
      </form>
    </Card>
  );
}
