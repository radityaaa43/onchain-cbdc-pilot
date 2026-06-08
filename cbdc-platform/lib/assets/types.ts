import { z } from "zod";

export const ASSET_TYPE_ENUM = { CBDC: 0, SRBI: 1, SBN: 2, SUKUK_IJARAH: 3, SUKUK_MUDHARABAH: 4, SUKUK_WAKALAH: 5 } as const;
export type AssetType = keyof typeof ASSET_TYPE_ENUM;
export const ASSET_TYPES = Object.keys(ASSET_TYPE_ENUM) as AssetType[];
export const SUKUK_TYPES: AssetType[] = ["SUKUK_IJARAH", "SUKUK_MUDHARABAH", "SUKUK_WAKALAH"];

export const assetClassOf = (t: AssetType): "cash" | "bond" => (t === "CBDC" ? "cash" : "bond");

const Address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

export const CreateAssetBody = z
  .object({
    assetType: z.enum(ASSET_TYPES as [AssetType, ...AssetType[]]),
    name: z.string().min(1),
    symbol: z.string().min(1),
    isin: z.string().optional(),
    currency: z.string().default("IDR"),
    // cash
    decimals: z.number().int().min(0).max(18).optional(),
    // bond / sukuk
    maturityDate: z.number().int().positive().optional(),
    couponRateBps: z.number().int().nonnegative().optional(),
    principalAmount: z.number().int().positive().optional(),
    finalRedemptionPct: z.number().int().min(0).max(10000).optional(),
    dayCount: z.number().int().min(0).max(4).optional(),
    shariahBoard: Address.optional(),
  })
  .superRefine((v, ctx) => {
    if (assetClassOf(v.assetType) === "bond") {
      for (const f of ["maturityDate", "couponRateBps", "principalAmount", "finalRedemptionPct"] as const)
        if (v[f] === undefined) ctx.addIssue({ code: "custom", path: [f], message: `${f} required for bonds` });
      if (SUKUK_TYPES.includes(v.assetType) && !v.shariahBoard)
        ctx.addIssue({ code: "custom", path: ["shariahBoard"], message: "shariahBoard required for sukuk" });
    }
  });

export type CreateAssetInput = z.infer<typeof CreateAssetBody>;
