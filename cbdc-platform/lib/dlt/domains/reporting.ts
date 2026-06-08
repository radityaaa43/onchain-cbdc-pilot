import { dltGet, dltTx } from "../client";

export interface TxRecord {
  assetId: string;
  from: string;
  to: string;
  amount: string;
  ref: string;
  timestamp: string;
  blockNumber: string;
}

export const reporting = {
  logTransaction: (b: { assetId: string; from: string; to: string; amount: number; ref: string }) =>
    dltTx<{ ok: boolean }>(`/reporting/transaction`, b),

  generateSar: (entity: string) =>
    dltTx<{ reportId: string }>(`/reporting/sar`, { entity }),

  transactions: (q: { entity: string; fromBlock: string; toBlock: string }) =>
    dltGet<{ records: TxRecord[] }>(
      `/reporting/transactions?entity=${q.entity}&fromBlock=${q.fromBlock}&toBlock=${q.toBlock}`
    ),

  exportRaw: (q: { assetId: string; fromBlock: string; toBlock: string }) =>
    dltGet<{ data: string }>(
      `/reporting/export?assetId=${q.assetId}&fromBlock=${q.fromBlock}&toBlock=${q.toBlock}`
    ),

  exportPaginated: (q: { offset: number; limit: number }) =>
    dltGet<{ records: TxRecord[]; total: string }>(
      `/reporting/export/paginated?offset=${q.offset}&limit=${q.limit}`
    ),
};
