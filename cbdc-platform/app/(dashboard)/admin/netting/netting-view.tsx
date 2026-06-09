"use client";
import { Fragment, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SESSION_STATUS: Record<number, string> = { 0: "Open", 1: "Settled", 2: "Cancelled" };

export function NettingView() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<Record<string, unknown> | null>(null);
  const [entries, setEntries] = useState<Array<{ from: string; to: string; amount: string }>>([]);
  const [loading, setLoading] = useState(false);

  async function post(action: string, body?: Record<string, unknown>) {
    const key = crypto.randomUUID();
    setLoading(true);
    try {
      const res = await fetch("/api/dlt/netting", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed"); return null; }
      return data;
    } finally { setLoading(false); }
  }

  async function openSession() {
    const data = await post("open-session");
    if (data) toast.success(`Session opening — op ${data.operationId}`);
  }

  async function lookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const id = String(new FormData(e.currentTarget).get("sessionId"));
    setLoading(true);
    try {
      const [sessRes, entrRes] = await Promise.all([
        fetch(`/api/dlt/netting?sessionId=${encodeURIComponent(id)}`),
        fetch(`/api/dlt/netting?sessionId=${encodeURIComponent(id)}&type=entries`),
      ]);
      if (!sessRes.ok) { toast.error("Session not found"); return; }
      const sessData = await sessRes.json();
      setSession(sessData.session ?? sessData);
      setSessionId(id);
      if (entrRes.ok) { const e = await entrRes.json(); setEntries(e.entries ?? []); }
    } finally { setLoading(false); }
  }

  async function addEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!sessionId) return;
    await post("add-entry", { sessionId, from: String(f.get("from")), to: String(f.get("to")), amount: Number(f.get("amount")) });
    toast.success("Entry added");
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-card/80 border-border">
        <h2 className="font-mono text-sm mb-3">Session Management</h2>
        <div className="flex gap-2 mb-4">
          <Button variant="outline" disabled={loading} onClick={openSession}>Open New Session</Button>
        </div>
        <form onSubmit={lookup} className="flex gap-3 items-end">
          <div className="space-y-2 flex-1"><Label>Session ID</Label><Input name="sessionId" required placeholder="0x..." /></div>
          <Button type="submit" disabled={loading}>Load</Button>
        </form>
        {session && (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {Object.entries(session).map(([k, v]) => (
                <Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd>{String(v)}</dd></Fragment>
              ))}
            </dl>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" disabled={loading} onClick={() => post("settle", { sessionId: sessionId! }).then(() => toast.success("Settle submitted"))}>Settle</Button>
              <Button size="sm" variant="destructive" disabled={loading} onClick={() => post("cancel", { sessionId: sessionId! }).then(() => toast.success("Cancel submitted"))}>Cancel</Button>
            </div>
          </>
        )}
      </Card>

      {sessionId && (
        <Card className="p-4 bg-card/80 border-border">
          <h2 className="font-mono text-sm mb-3">Add Entry</h2>
          <form onSubmit={addEntry} className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>From</Label><Input name="from" required placeholder="0x..." /></div>
            <div className="space-y-2"><Label>To</Label><Input name="to" required placeholder="0x..." /></div>
            <div className="space-y-2"><Label>Amount</Label><Input name="amount" type="number" min={1} required /></div>
            <div className="space-y-2 flex items-end"><Button type="submit" disabled={loading}>Add</Button></div>
          </form>
          {entries.length > 0 && (
            <table className="mt-3 w-full text-xs font-mono">
              <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="py-1 pr-3">From</th><th className="py-1 pr-3">To</th><th className="py-1">Amount</th></tr></thead>
              <tbody>{entries.map((e, i) => <tr key={i} className="border-b border-border/50"><td className="py-1 pr-3">{e.from.slice(0, 10)}…</td><td className="py-1 pr-3">{e.to.slice(0, 10)}…</td><td className="py-1">{e.amount}</td></tr>)}</tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
