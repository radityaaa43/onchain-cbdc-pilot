"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DvpStatusLookup() {
  const [data, setData] = useState<unknown>(null);
  const [err, setErr] = useState("");
  async function look(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const id = String(new FormData(e.currentTarget).get("id"));
    const res = await fetch(`/api/dlt/dvp/${id}`);
    if (!res.ok) { setErr("Lookup failed"); return; }
    setData((await res.json()).settlement);
  }
  return (
    <Card className="p-4 bg-card/80 border-border">
      <h2 className="font-mono text-sm mb-3">Settlement status</h2>
      <form onSubmit={look} className="flex gap-2 items-end">
        <div className="flex-1 space-y-2"><Label htmlFor="id">Settlement ID</Label><Input id="id" name="id" required /></div>
        <Button type="submit">Lookup</Button>
      </form>
      {err && <p role="alert" className="text-sm text-destructive mt-2">{err}</p>}
      {data != null && (
        <pre className="mt-3 text-xs tabular bg-muted p-3 rounded-md overflow-auto">{JSON.stringify(data, null, 2)}</pre>
      )}
    </Card>
  );
}
