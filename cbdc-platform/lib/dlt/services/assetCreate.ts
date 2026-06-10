import { bonds } from "@/lib/dlt/domains/bonds";
import { bondMetadata } from "@/lib/dlt/domains/bondMetadata";
import { coupon } from "@/lib/dlt/domains/coupon";
import { maturity } from "@/lib/dlt/domains/maturity";
import { shariah } from "@/lib/dlt/domains/shariah";
import { SUKUK_TYPES, type CreateAssetInput } from "@/lib/assets/types";

function toIsoDate(unixSecs: number): string {
  return new Date(unixSecs * 1000).toISOString().split("T")[0];
}

function issuanceTypeOf(assetType: string): string {
  if (assetType.startsWith("SUKUK")) return "Sukuk";
  return "Government";
}

export async function createBondOnChain(input: CreateAssetInput): Promise<{ bondId: string }> {
  const { bondId } = await bonds.register({ maturityDate: input.maturityDate! });
  const now = Math.floor(Date.now() / 1000);
  const staticData = {
    isin: input.isin ?? input.symbol,
    issuerLei: "549300BI0000000000001",
    issuerName: "Bank Indonesia",
    issuanceType: issuanceTypeOf(input.assetType),
    currency: input.currency,
    paymentCurrency: input.currency,
    settlementCurrency: input.currency,
    denomination: input.principalAmount ?? 1000000,
    integralMultiples: input.principalAmount ?? 1000000,
    calculationAmount: input.principalAmount ?? 1000000,
    pricingDate: toIsoDate(now),
    issuanceDate: toIsoDate(now),
    settlementDate: toIsoDate(now + 2 * 86400),
    issuePrice: 10000,
    methodOfDistribution: "Auction",
    governingLaw: "Indonesia",
    formOfNote: "Digital",
    statusOfNote: "Senior",
    aggregateNominalAmount: input.principalAmount ?? 1000000,
    maturityDate: toIsoDate(input.maturityDate!),
    dltBondIndicator: true,
    listingMarket: "BI-SSSS",
    listingMarketType: "Regulated",
    clearingSettlementSystem: "On-chain",
    sellingRestrictions: "",
    manufacturerTargetMarket: "Institutional",
    flagNegativePledge: false,
    flagGrossUp: false,
    flagCrossDefault: false,
  };
  await bondMetadata.setStatic(staticData);
  await coupon.setRate({ bondId, rateBps: input.couponRateBps! });
  if (input.dayCount !== undefined) await coupon.setDayCount({ bondId, convention: input.dayCount });
  await maturity.setInfo({ bondId, maturityDate: input.maturityDate!, finalRedemptionPct: input.finalRedemptionPct!, principalAmount: input.principalAmount! });
  if (SUKUK_TYPES.includes(input.assetType)) await shariah.approveSukuk({ bondId, shariahBoard: input.shariahBoard! });
  return { bondId };
}
