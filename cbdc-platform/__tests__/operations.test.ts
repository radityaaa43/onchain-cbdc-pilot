import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const store = new Map<string, any>();
  return {
    db: {
      operation: {
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.idempotencyKey) return store.get("ik:" + where.idempotencyKey) ?? null;
          if (where.id) return store.get("id:" + where.id) ?? null;
          return null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const op = { id: "op-" + data.idempotencyKey, ...data };
          store.set("id:" + op.id, op);
          store.set("ik:" + op.idempotencyKey, op);
          return op;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const existing = store.get("id:" + where.id) ?? {};
          const op = { ...existing, ...data };
          store.set("id:" + op.id, op);
          store.set("ik:" + op.idempotencyKey, op);
          return op;
        }),
      },
      auditLog: { create: vi.fn(async () => ({})) },
    },
  };
});

import { runOperation } from "@/lib/operations";

const ctx = { userId: "u1", orgId: "o1" };

describe("runOperation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns SUCCESS with txHash when executor resolves", async () => {
    const op = await runOperation(
      { ...ctx, action: "cbdc.issue", idempotencyKey: "k1", request: {} },
      async () => ({ txHash: "0xabc", result: { ok: true } }),
    );
    expect(op.status).toBe("SUCCESS");
    expect(op.txHash).toBe("0xabc");
  });

  it("returns FAILED with error when executor throws", async () => {
    const op = await runOperation(
      { ...ctx, action: "cbdc.issue", idempotencyKey: "k2", request: {} },
      async () => { throw new Error("revert"); },
    );
    expect(op.status).toBe("FAILED");
    expect(op.error).toContain("revert");
  });

  it("deduplicates on repeated idempotency key", async () => {
    await runOperation({ ...ctx, action: "x", idempotencyKey: "k3", request: {} }, async () => ({ txHash: "0x1" }));
    const calls: number[] = [];
    await runOperation(
      { ...ctx, action: "x", idempotencyKey: "k3", request: {} },
      async () => { calls.push(1); return { txHash: "0x2" }; },
    );
    expect(calls.length).toBe(0);
  });
});
