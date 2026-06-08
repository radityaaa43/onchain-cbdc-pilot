import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/rbac", () => ({
  requirePermission: vi.fn(async () => ({
    userId: "u1", orgId: "o1",
    orgAddress: "0x0000000000000000000000000000000000000001",
    roles: ["COMPLIANCE_OFFICER"],
  })),
  AuthError: class AuthError extends Error {
    constructor(message: string, public httpStatus: number) { super(message); }
  },
}));
vi.mock("@/lib/operations", () => ({
  startOperation: vi.fn(async () => ({ operationId: "op-r1" })),
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public httpStatus: number) { super(message); }
  },
}));
vi.mock("@/lib/dlt/domains/reporting", () => ({
  reporting: {
    transactions: vi.fn(async () => ({ records: [] })),
    exportPaginated: vi.fn(async () => ({ records: [], total: "0" })),
    exportRaw: vi.fn(async () => ({ data: "0x" })),
    generateSar: vi.fn(async () => ({ reportId: "0xsar" })),
  },
}));

import { GET as txGet } from "@/app/api/dlt/reporting/transactions/route";
import { GET as exportGet } from "@/app/api/dlt/reporting/export/route";
import { POST as sarPost } from "@/app/api/dlt/reporting/sar/route";
import { startOperation } from "@/lib/operations";
import { reporting } from "@/lib/dlt/domains/reporting";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/dlt/reporting/transactions", () => {
  it("returns 400 when entity missing", async () => {
    const res = await txGet(new Request("http://localhost/api/dlt/reporting/transactions?fromBlock=0&toBlock=100"));
    expect(res.status).toBe(400);
  });
  it("returns 200 with records on valid query", async () => {
    const res = await txGet(new Request("http://localhost/api/dlt/reporting/transactions?entity=0x0000000000000000000000000000000000000002&fromBlock=0&toBlock=100"));
    expect(res.status).toBe(200);
    expect(reporting.transactions).toHaveBeenCalledOnce();
  });
});

describe("GET /api/dlt/reporting/export", () => {
  it("calls exportPaginated when paginated=true", async () => {
    const res = await exportGet(new Request("http://localhost/api/dlt/reporting/export?paginated=true&offset=0&limit=20"));
    expect(res.status).toBe(200);
    expect(reporting.exportPaginated).toHaveBeenCalledOnce();
  });
  it("returns 400 when raw export missing assetId", async () => {
    const res = await exportGet(new Request("http://localhost/api/dlt/reporting/export?fromBlock=0&toBlock=100"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/dlt/reporting/sar", () => {
  it("returns 202 with operationId for valid entity", async () => {
    const res = await sarPost(new Request("http://localhost/api/dlt/reporting/sar", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "idem-1" },
      body: JSON.stringify({ entity: "0x0000000000000000000000000000000000000002" }),
    }));
    expect(res.status).toBe(202);
    expect((await res.json()).operationId).toBe("op-r1");
    expect(startOperation).toHaveBeenCalledOnce();
  });
  it("returns 422 on invalid entity address", async () => {
    const res = await sarPost(new Request("http://localhost/api/dlt/reporting/sar", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "idem-1" },
      body: JSON.stringify({ entity: "not-an-address" }),
    }));
    expect(res.status).toBe(422);
  });
});
