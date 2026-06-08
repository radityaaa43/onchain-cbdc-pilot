import { describe, it, expect } from "vitest";
import { CreateAssetBody, assetClassOf, ASSET_TYPE_ENUM } from "@/lib/assets/types";

describe("asset types", () => {
  it("maps SBN to enum value 2", () => {
    expect(ASSET_TYPE_ENUM.SBN).toBe(2);
  });
  it("classifies CBDC as cash, SUKUK_IJARAH as bond", () => {
    expect(assetClassOf("CBDC")).toBe("cash");
    expect(assetClassOf("SUKUK_IJARAH")).toBe("bond");
  });
  it("requires maturity fields for a bond, not for cash", () => {
    expect(CreateAssetBody.safeParse({ assetType: "CBDC", name: "Rupiah Digital", symbol: "wIDR", decimals: 18 }).success).toBe(true);
    expect(CreateAssetBody.safeParse({ assetType: "SBN", name: "FR0100", symbol: "FR0100" }).success).toBe(false);
    expect(CreateAssetBody.safeParse({ assetType: "SBN", name: "FR0100", symbol: "FR0100", maturityDate: 1893456000, couponRateBps: 600, principalAmount: 1000000000, finalRedemptionPct: 10000 }).success).toBe(true);
  });
  it("requires shariahBoard for sukuk", () => {
    expect(CreateAssetBody.safeParse({ assetType: "SUKUK_IJARAH", name: "PBS", symbol: "PBS", maturityDate: 1893456000, couponRateBps: 600, principalAmount: 1000000000, finalRedemptionPct: 10000 }).success).toBe(false);
  });
});
