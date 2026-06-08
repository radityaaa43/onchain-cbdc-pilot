import { dltTx } from "../client";

export const bondMetadata = {
  setStatic: (data: Record<string, unknown>) => dltTx<{ ok: boolean }>(`/bond-metadata/static`, { data }),
  setTerms: (data: Record<string, unknown>) => dltTx<{ ok: boolean }>(`/bond-metadata/terms`, { data }),
  setRatings: (data: Record<string, unknown>) => dltTx<{ ok: boolean }>(`/bond-metadata/ratings`, { data }),
  setIndonesian: (data: Record<string, unknown>) => dltTx<{ ok: boolean }>(`/bond-metadata/indonesian-market`, { data }),
};
