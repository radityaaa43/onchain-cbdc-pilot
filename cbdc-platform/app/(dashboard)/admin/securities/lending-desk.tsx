"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function LendingDeskView() {
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const lendId = String(new FormData(e.currentTarget).get("lendId"));
    setLoading(true);
    try {
      const res = await fetch(`/api/dlt/lending?lendId=${encodeURIComponent(lendId)}`);
      if (!res.ok) { toast.error("Not found"); return; }
      setDetail(await res.json());
    } finally { setLoading(false); }
  }

  return (
    <Card className="p-4 bg-card/80 border-border">
      <h2 className="font-mono text-sm mb-3">Lending Monitor</h2>
      <form onSubmit={lookup} className="flex gap-3 items-end mb-4">
        <div className="space-y-2 flex-1"><Label htmlFor="lendId">Lend ID</Label><Input id="lendId" name="lendId" required placeholder="0x..." /></div>
        <Button type="submit" disabled={loading}>Lookup</Button>
      </form>
      {detail && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {Object.entries(detail).map(([k, v]) => (
            <><dt key={`k-${k}`} className="text-muted-foreground">{k}</dt><dd key={`v-${k}`} className="font-mono text-xs break-all">{String(v)}</dd></>
          ))}
        </dl>
      )}
    </Card>
  );
}
