"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ASSET_TYPES, assetClassOf, type AssetType } from "@/lib/assets/types";
import { toast } from "sonner";

const LABELS: Record<AssetType, string> = {
  CBDC: "Cash / Wholesale CBDC",
  SBN: "Bond — SBN",
  SRBI: "Bond — SRBI (min 1jt)",
  SUKUK_IJARAH: "Sukuk — Ijarah",
  SUKUK_MUDHARABAH: "Sukuk — Mudharabah",
  SUKUK_WAKALAH: "Sukuk — Wakalah",
};

export function AssetWizard() {
  const router = useRouter();
  const [type, setType] = useState<AssetType>("SBN");
  const [busy, setBusy] = useState(false);
  const isBond = assetClassOf(type) === "bond";
  const isSukuk = type.startsWith("SUKUK");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const num = (k: string) => (fd.get(k) ? Number(fd.get(k)) : undefined);
    const body: Record<string, unknown> = {
      assetType: type,
      name: fd.get("name"),
      symbol: fd.get("symbol"),
      isin: fd.get("isin") || undefined,
      currency: fd.get("currency") || "IDR",
    };
    if (isBond)
      Object.assign(body, {
        maturityDate: num("maturityDate"),
        couponRateBps: num("couponRateBps"),
        principalAmount: num("principalAmount"),
        finalRedemptionPct: num("finalRedemptionPct"),
        dayCount: num("dayCount"),
      });
    else body.decimals = num("decimals") ?? 18;
    if (isSukuk) body.shariahBoard = fd.get("shariahBoard");

    setBusy(true);
    const res = await fetch("/api/dlt/assets", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error("Create failed: " + JSON.stringify((await res.json()).error));
      return;
    }
    toast.success("Asset created");
    router.push("/admin/assets");
  }

  return (
    <Card className="max-w-2xl p-6 bg-card/80 backdrop-blur border-border">
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="type">Contract base</Label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as AssetType)}
            className="w-full h-10 rounded-md bg-muted border border-border px-3 text-sm"
          >
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field name="name" label="Name" required />
          <Field name="symbol" label="Symbol / ISIN code" required />
          <Field name="isin" label="ISIN (optional)" />
          <Field name="currency" label="Currency" defaultValue="IDR" />
        </div>
        {!isBond && (
          <div className="grid grid-cols-2 gap-4">
            <Field name="decimals" label="Decimals" type="number" defaultValue="18" />
          </div>
        )}
        {isBond && (
          <div className="grid grid-cols-2 gap-4">
            <Field name="maturityDate" label="Maturity (unix sec)" type="number" required />
            <Field name="couponRateBps" label="Coupon rate (bps)" type="number" required />
            <Field name="principalAmount" label="Principal amount" type="number" required />
            <Field name="finalRedemptionPct" label="Final redemption (bps)" type="number" defaultValue="10000" required />
            <Field name="dayCount" label="Day count (0-4)" type="number" />
            {isSukuk && <Field name="shariahBoard" label="Shariah board address" required />}
          </div>
        )}
        <Button type="submit" disabled={busy} className="glow-primary">
          {busy ? "Creating…" : "Create asset"}
        </Button>
      </form>
    </Card>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className={type === "number" ? "tabular" : ""}
      />
    </div>
  );
}
