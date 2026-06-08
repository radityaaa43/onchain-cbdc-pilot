import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only so it doesn't throw outside Next.js runtime
vi.mock("server-only", () => ({}));

// Mock @prisma/adapter-pg and PrismaClient to avoid real DB connection
vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class {
    constructor(_opts: unknown) {}
  },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    org = {};
    user = {};
    userRole = {};
    auditLog = {};
    operation = {};
    instrument = {};
    auctionRound = {};
    allocation = {};
    constructor(_opts: unknown) {}
  },
}));

describe("db singleton", () => {
  beforeEach(() => {
    // Clear the global prisma singleton between tests
    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;
    vi.resetModules();
  });

  it("returns the same instance on repeated imports", async () => {
    const { db: db1 } = await import("@/lib/db");
    const { db: db2 } = await import("@/lib/db");
    expect(db1).toBe(db2);
  });

  it("exposes expected model accessors", async () => {
    const { db } = await import("@/lib/db");
    const models = [
      "org",
      "user",
      "userRole",
      "auditLog",
      "operation",
      "instrument",
      "auctionRound",
      "allocation",
    ] as const;
    for (const model of models) {
      expect(db).toHaveProperty(model);
    }
  });
});
