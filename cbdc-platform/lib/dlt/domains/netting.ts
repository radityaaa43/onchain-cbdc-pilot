import { dltGet, dltTx } from "../client";

export type NettingSession = {
  session: { sessionId: string; status: number; createdAt: string; entryCount: string };
};
export type NettingEntries = {
  entries: Array<{ from: string; to: string; amount: string }>;
};

export const netting = {
  openSession: () =>
    dltTx<{ sessionId: string }>(`/netting/session`, {}),

  addEntry: (b: { sessionId: string; from: string; to: string; amount: number }) =>
    dltTx<{ ok: boolean }>(`/netting/session/entry`, b),

  settle: (sessionId: string) =>
    dltTx<{ ok: boolean }>(`/netting/session/${sessionId}/settle`, {}),

  cancel: (sessionId: string) =>
    dltTx<{ ok: boolean }>(`/netting/session/${sessionId}/cancel`, {}),

  getSession: (sessionId: string) =>
    dltGet<NettingSession>(`/netting/session/${sessionId}`),

  getEntries: (sessionId: string) =>
    dltGet<NettingEntries>(`/netting/session/${sessionId}/entries`),
};
