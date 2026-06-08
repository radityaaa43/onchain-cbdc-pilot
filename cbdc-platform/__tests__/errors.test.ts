import { describe, it, expect } from "vitest";
import { mapDltError } from "@/lib/dlt/errors";

describe("mapDltError", () => {
  it("maps 401 to a 502 DLT_AUTH error", () => {
    const e = mapDltError(401, { error: "Unauthorized" });
    expect(e.httpStatus).toBe(502);
    expect(e.code).toBe("DLT_AUTH");
  });
  it("maps 500 to 502 DLT_TX with message", () => {
    const e = mapDltError(500, { error: 'TX failed: "revert"' });
    expect(e.httpStatus).toBe(502);
    expect(e.code).toBe("DLT_TX");
    expect(e.message).toContain("revert");
  });
  it("maps 400 to 422 DLT_VALIDATION", () => {
    const e = mapDltError(400, { error: { fieldErrors: { amount: ["required"] } } });
    expect(e.httpStatus).toBe(422);
    expect(e.code).toBe("DLT_VALIDATION");
  });
});
