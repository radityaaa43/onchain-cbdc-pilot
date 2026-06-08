import { cbdc } from "@/lib/dlt/domains/cbdc";

export async function releaseCash(b: { to: string; amount: number }): Promise<{ ok: boolean }> {
  return cbdc.issue(b);
}
