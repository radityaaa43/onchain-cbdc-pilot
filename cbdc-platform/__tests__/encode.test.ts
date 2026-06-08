import { describe, it, expect } from "vitest";
import { stateHash, bondInitData, cbdcInitData } from "@/lib/dlt/encode";

describe("encode", () => {
  it("stateHash returns 32-byte hex string", () => {
    expect(stateHash("PRIMARY")).toMatch(/^0x[0-9a-f]{64}$/);
  });
  it("cbdcInitData returns 0x-prefixed bytes", () => {
    const d = cbdcInitData("CBDC Token", "CBDC", 18);
    expect(d.startsWith("0x")).toBe(true);
    expect(d.length).toBeGreaterThan(2);
  });
  it("bondInitData returns 0x-prefixed bytes", () => {
    const d = bondInitData(1_000_000n);
    expect(d.startsWith("0x")).toBe(true);
  });
});
