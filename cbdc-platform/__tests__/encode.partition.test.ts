import { describe, it, expect } from "vitest";
import { partition, stateHash } from "@/lib/dlt/encode";
import { solidityPackedKeccak256, id } from "ethers";

const BOND = "0x" + "ab".repeat(32);

describe("partition", () => {
  it("equals keccak256(abi.encodePacked(bondId, keccak256(state)))", () => {
    const expected = solidityPackedKeccak256(["bytes32", "bytes32"], [BOND, id("SECONDARY")]);
    expect(partition(BOND, "SECONDARY")).toBe(expected);
  });
  it("returns a 32-byte hex", () => {
    expect(partition(BOND, "PRIMARY")).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
