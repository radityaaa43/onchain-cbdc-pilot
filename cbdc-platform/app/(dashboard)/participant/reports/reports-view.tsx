"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface TxRecord {
  assetId: string; from: string; to: string; amount: string;
  ref: string; timestamp: string; blockNumber: string;
}

export function ReportsView() {
  const [records, setRecords] = useState<TxRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal]     = useState<string | null>(null);
  const [offset, setOffset]   = useState(0);
  const LIMIT = 20;

  async function fetchPage(page: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/dlt/reporting/export?paginated=true&offset=${page * LIMIT}&limit=${LIMIT}`);
      if (!res.ok) { toast.error("Failed to load"); return; }
      const data = await res.json();
      setRecords(data.records ?? []);
      setTotal(data.total ?? null);
      setOffset(page);
    } finally {
      setLoading(false);
    }
  }

  async function searchByEntity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const entity    = String(f.get("entity"));
    const fromBlock = String(f.get("fromBlock") || "0");
    const toBlock   = String(f.get("toBlock") || "99999999");
    setLoading(true);
    try {
      const res = await fetch(`/api/dlt/reporting/transactions?entity=${entity}&fromBlock=${fromBlock}&toBlock=${toBlock}`);
      if (!res.ok) { toast.error("Search failed"); return; }
      const data = await res.json();
      setRecords(data.records ?? []);
      setTotal(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Search by Entity</h2>
        <form onSubmit={searchByEntity} className="flex flex-wrap gap-3 items-end">
          <div className="space-y-2 flex-1 min-w-40"><Label htmlFor="entity">Entity address</Label><Input id="entity" name="entity" required /></div>
          <div className="space-y-2 w-28"><Label htmlFor="fromBlock">From block</Label><Input id="fromBlock" name="fromBlock" type="number" min={0} placeholder="0" /></div>
          <div className="space-y-2 w-28"><Label htmlFor="toBlock">To block</Label><Input id="toBlock" name="toBlock" type="number" min={0} placeholder="latest" /></div>
          <Button type="submit" disabled={loading}>Search</Button>
        </form>
      </Card>

      <div className="flex gap-2 items-center">
        <Button variant="outline" size="sm" onClick={() => fetchPage(0)} disabled={loading}>Load All (paginated)</Button>
        {total != null && <span className="text-sm text-muted-foreground">Total: {total}</span>}
        {offset > 0 && <Button variant="ghost" size="sm" onClick={() => fetchPage(offset - 1)}>← Prev</Button>}
        {total != null && Number(total) > (offset + 1) * LIMIT && <Button variant="ghost" size="sm" onClick={() => fetchPage(offset + 1)}>Next →</Button>}
      </div>

      {records.length > 0 && (
        <Card className="p-4 bg-card/80 border-border overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3">Block</th>
                <th className="py-2 pr-3">From</th>
                <th className="py-2 pr-3">To</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2">Asset</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={`${r.blockNumber}-${r.from}-${r.to}-${r.amount}`} className="border-b border-border/50">
                  <td className="py-1.5 pr-3">{r.blockNumber}</td>
                  <td className="py-1.5 pr-3">{r.from.slice(0, 10)}…</td>
                  <td className="py-1.5 pr-3">{r.to.slice(0, 10)}…</td>
                  <td className="py-1.5 pr-3">{r.amount}</td>
                  <td className="py-1.5">{r.assetId.slice(0, 10)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {records.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground">No records. Use search or load paginated view.</p>
      )}
    </div>
  );
}
