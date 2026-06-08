import { db } from "@/lib/db";

export async function writeAudit(p: {
  userId: string;
  orgId: string;
  action: string;
  target?: string;
  payload: unknown;
  result: "ok" | "error";
  txHash?: string;
  error?: string;
}) {
  await db.auditLog.create({ data: { ...p, payload: p.payload as any } });
}
