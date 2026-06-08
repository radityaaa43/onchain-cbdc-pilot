import { dltTx, dltGet } from "../client";

export const tokenGateway = {
  createAsset: (b: { assetType: number; assetId: string; initData?: string }) =>
    dltTx<{ assetAddress: string }>(`/token-gateway/asset`, { initData: "0x", ...b }),

  address: (assetId: string) =>
    dltGet<{ assetId: string; address: string }>(`/token-gateway/asset/${assetId}/address`),

  type: (assetId: string) =>
    dltGet<{ assetId: string; assetType: number }>(`/token-gateway/asset/${assetId}/type`),

  registered: (assetId: string) =>
    dltGet<{ assetId: string; registered: boolean }>(`/token-gateway/asset/${assetId}/registered`),
};
