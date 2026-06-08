"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function SettleButton({ auctionId, disabled }: { auctionId: string; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function settle() {
    setBusy(true);
    const res = await fetch(`/api/dlt/auctions/${auctionId}/settle`, {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
    });
    setBusy(false);
    if (!res.ok) {
      toast.error("Settle failed");
      return;
    }
    toast.success("Settling allocations");
    router.refresh();
  }
  return (
    <Button onClick={settle} disabled={disabled || busy} className="glow-primary">
      {busy ? "Settling…" : "Settle auction"}
    </Button>
  );
}
