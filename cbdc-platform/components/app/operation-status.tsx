"use client";
import { useQuery } from "@tanstack/react-query";

interface OperationStatusProps {
  operationId: string;
}

export function OperationStatus({ operationId }: OperationStatusProps) {
  const { data } = useQuery({
    queryKey: ["operation", operationId],
    queryFn: async () => {
      const res = await fetch(`/api/operations/${operationId}`);
      return res.json();
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "SUCCESS" || status === "FAILED" ? false : 1500;
    },
  });

  if (!data) return <span className="text-muted-foreground text-sm">Pending…</span>;

  const colorClass =
    data.status === "SUCCESS"
      ? "text-positive"
      : data.status === "FAILED"
        ? "text-destructive"
        : "text-warning";

  return (
    <span className={`tabular text-sm ${colorClass}`}>
      {data.status}
      {data.txHash ? ` · ${data.txHash.slice(0, 10)}…` : ""}
      {data.error ? ` · ${data.error}` : ""}
    </span>
  );
}
