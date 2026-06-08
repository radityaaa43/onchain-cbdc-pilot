import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export type OpCtx = {
  userId: string;
  orgId: string;
  action: string;
  idempotencyKey: string;
  request: unknown;
};
export type Executor = () => Promise<{ txHash?: string; result?: unknown }>;

export async function runOperation(ctx: OpCtx, exec: Executor) {
  const existing = await db.operation.findUnique({ where: { idempotencyKey: ctx.idempotencyKey } });
  if (existing) return existing;
  const op = await db.operation.create({
    data: {
      idempotencyKey: ctx.idempotencyKey,
      userId: ctx.userId,
      orgId: ctx.orgId,
      action: ctx.action,
      request: ctx.request as any,
      status: "PENDING",
    },
  });
  try {
    const { txHash, result } = await exec();
    const done = await db.operation.update({
      where: { id: op.id },
      data: { status: "SUCCESS", txHash, result: (result ?? null) as any },
    });
    await writeAudit({ userId: ctx.userId, orgId: ctx.orgId, action: ctx.action, payload: ctx.request, result: "ok", txHash });
    return done;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const failed = await db.operation.update({
      where: { id: op.id },
      data: { status: "FAILED", error: msg },
    });
    await writeAudit({ userId: ctx.userId, orgId: ctx.orgId, action: ctx.action, payload: ctx.request, result: "error", error: msg });
    return failed;
  }
}

export async function startOperation(ctx: OpCtx, exec: Executor): Promise<{ operationId: string }> {
  const existing = await db.operation.findUnique({ where: { idempotencyKey: ctx.idempotencyKey } });
  if (existing) return { operationId: existing.id };
  const op = await db.operation.create({
    data: {
      idempotencyKey: ctx.idempotencyKey,
      userId: ctx.userId,
      orgId: ctx.orgId,
      action: ctx.action,
      request: ctx.request as any,
      status: "PENDING",
    },
  });
  void (async () => {
    try {
      const { txHash, result } = await exec();
      await db.operation.update({ where: { id: op.id }, data: { status: "SUCCESS", txHash, result: (result ?? null) as any } });
      await writeAudit({ userId: ctx.userId, orgId: ctx.orgId, action: ctx.action, payload: ctx.request, result: "ok", txHash });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.operation.update({ where: { id: op.id }, data: { status: "FAILED", error: msg } });
      await writeAudit({ userId: ctx.userId, orgId: ctx.orgId, action: ctx.action, payload: ctx.request, result: "error", error: msg });
    }
  })();
  return { operationId: op.id };
}
