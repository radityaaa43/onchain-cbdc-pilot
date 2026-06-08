import { bonds } from "@/lib/dlt/domains/bonds";
import { bondMetadata } from "@/lib/dlt/domains/bondMetadata";
import { coupon } from "@/lib/dlt/domains/coupon";
import { maturity } from "@/lib/dlt/domains/maturity";
import { shariah } from "@/lib/dlt/domains/shariah";
import { SUKUK_TYPES, type CreateAssetInput } from "@/lib/assets/types";

export async function createBondOnChain(input: CreateAssetInput): Promise<{ bondId: string }> {
  const { bondId } = await bonds.register({ maturityDate: input.maturityDate! });
  await bondMetadata.setStatic({ isin: input.isin ?? input.symbol, name: input.name, currency: input.currency, symbol: input.symbol });
  await coupon.setRate({ bondId, rateBps: input.couponRateBps! });
  if (input.dayCount !== undefined) await coupon.setDayCount({ bondId, convention: input.dayCount });
  await maturity.setInfo({ bondId, maturityDate: input.maturityDate!, finalRedemptionPct: input.finalRedemptionPct!, principalAmount: input.principalAmount! });
  if (SUKUK_TYPES.includes(input.assetType)) await shariah.approveSukuk({ bondId, shariahBoard: input.shariahBoard! });
  return { bondId };
}
