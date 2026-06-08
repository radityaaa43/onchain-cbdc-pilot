"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function CustodyView() {
  const [holdings, setHoldings] = useState<{ custodian: string; bondId: string; holdings: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookupHoldings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const custodian = String(f.get("custodian"));
    const bondId    = String(f.get("bondId"));
    setLoading(true);
    try {
      const res = await fetch(`/api/dlt/custody?type=holdings&custodian=${encodeURIComponent(custodian)}&bondId=${encodeURIComponent(bondId)}`);
      if (!res.ok) { toast.error("Lookup failed"); return; }
      setHoldings(await res.json());
    } finally { setLoading(false); }
  }

  async function registerCustodian(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const custodian = String(new FormData(e.currentTarget).get("newCustodian"));
    const key = crypto.randomUUID();
    setLoading(true);
    try {
      const res = await fetch("/api/dlt/custody", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({ action: "register-custodian", custodian }),
      });
      if (!res.ok) { toast.error("Register failed"); return; }
      toast.success("Custodian registration submitted");
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Holdings Lookup</h2>
        <form onSubmit={lookupHoldings} className="flex flex-wrap gap-3 items-end">
          <div className="space-y-2 flex-1 min-w-40"><Label htmlFor="custodian">Custodian address</Label><Input id="custodian" name="custodian" required placeholder="0x..." /></div>
          <div className="space-y-2 flex-1 min-w-40"><Label htmlFor="bondId">Bond ID</Label><Input id="bondId" name="bondId" required placeholder="0x..." /></div>
          <Button type="submit" disabled={loading}>Lookup</Button>
        </form>
        {holdings && (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Custodian</dt><dd className="font-mono text-xs truncate">{holdings.custodian}</dd>
            <dt className="text-muted-foreground">Holdings</dt><dd className="tabular-nums">{holdings.holdings}</dd>
          </dl>
        )}
      </Card>

      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Register Custodian</h2>
        <form onSubmit={registerCustodian} className="flex gap-3 items-end">
          <div className="space-y-2 flex-1"><Label htmlFor="newCustodian">Custodian address</Label><Input id="newCustodian" name="newCustodian" required placeholder="0x..." /></div>
          <Button type="submit" disabled={loading}>Register</Button>
        </form>
      </Card>
    </div>
  );
}
