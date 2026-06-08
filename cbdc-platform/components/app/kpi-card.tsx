import { Card } from "@/components/ui/card";

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}

export function KpiCard({ label, value, unit, accent }: KpiCardProps) {
  return (
    <Card className={`p-4 bg-card/80 backdrop-blur border-border ${accent ? "glow-primary" : ""}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl tabular text-foreground">
        {value}
        {unit && <span className="text-sm text-muted-foreground ml-1">{unit}</span>}
      </p>
    </Card>
  );
}
