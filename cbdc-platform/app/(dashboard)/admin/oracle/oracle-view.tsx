"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function OracleView() {
  const [rateResult, setRateResult]   = useState<{ rate: string } | null>(null);
  const [priceResult, setPriceResult] = useState<{ price: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function post(action: string, body: Record<string, unknown>) {
    const key = crypto.randomUUID();
    setLoading(true);
    try {
      const res = await fetch("/api/dlt/oracle", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed"); return; }
      toast.success(`${action} submitted — op ${data.operationId}`);
    } finally { setLoading(false); }
  }

  async function getRate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const bondId = String(new FormData(e.currentTarget).get("bondId"));
    setLoading(true);
    try {
      const res = await fetch(`/api/dlt/oracle?type=rate&bondId=${encodeURIComponent(bondId)}`);
      if (!res.ok) { toast.error("Not found"); return; }
      setRateResult(await res.json());
    } finally { setLoading(false); }
  }

  async function getPrice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const bondId = String(new FormData(e.currentTarget).get("bondIdPrice"));
    setLoading(true);
    try {
      const res = await fetch(`/api/dlt/oracle?type=price&bondId=${encodeURIComponent(bondId)}`);
      if (!res.ok) { toast.error("Not found"); return; }
      setPriceResult(await res.json());
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Set Rate</h2>
        <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); post("set-rate", { bondId: String(f.get("bondId")), rate: Number(f.get("rate")) }); }} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-2"><Label>Bond ID</Label><Input name="bondId" required placeholder="0x..." /></div>
          <div className="space-y-2"><Label>Rate (bps)</Label><Input name="rate" type="number" min={0} required /></div>
          <div className="space-y-2 flex items-end"><Button type="submit" disabled={loading}>Set Rate</Button></div>
        </form>
      </Card>

      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Set Price</h2>
        <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); post("set-price", { bondId: String(f.get("bondIdP")), price: Number(f.get("price")) }); }} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-2"><Label>Bond ID</Label><Input name="bondIdP" required placeholder="0x..." /></div>
          <div className="space-y-2"><Label>Price</Label><Input name="price" type="number" min={1} required /></div>
          <div className="space-y-2 flex items-end"><Button type="submit" disabled={loading}>Set Price</Button></div>
        </form>
      </Card>

      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Lookup Rate / Price</h2>
        <div className="grid grid-cols-2 gap-4">
          <form onSubmit={getRate} className="space-y-3">
            <div className="space-y-2"><Label>Bond ID (rate)</Label><Input name="bondId" required placeholder="0x..." /></div>
            <Button type="submit" size="sm" disabled={loading}>Get Rate</Button>
            {rateResult && <p className="text-sm">Rate: <span className="font-mono">{rateResult.rate}</span> bps</p>}
          </form>
          <form onSubmit={getPrice} className="space-y-3">
            <div className="space-y-2"><Label>Bond ID (price)</Label><Input name="bondIdPrice" required placeholder="0x..." /></div>
            <Button type="submit" size="sm" disabled={loading}>Get Price</Button>
            {priceResult && <p className="text-sm">Price: <span className="font-mono">{priceResult.price}</span></p>}
          </form>
        </div>
      </Card>

      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Report Credit Event</h2>
        <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); post("credit-event", { bondId: String(f.get("bondIdCE")), eventType: String(f.get("eventType")), timestamp: Number(f.get("timestamp")) }); }} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-2"><Label>Bond ID</Label><Input name="bondIdCE" required placeholder="0x..." /></div>
          <div className="space-y-2"><Label>Event Type (bytes32)</Label><Input name="eventType" required placeholder="0x..." /></div>
          <div className="space-y-2"><Label>Timestamp (unix)</Label><Input name="timestamp" type="number" min={0} required /></div>
          <div className="col-span-2"><Button type="submit" disabled={loading}>Report</Button></div>
        </form>
      </Card>
    </div>
  );
}
