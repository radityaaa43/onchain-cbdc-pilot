import { bonds } from "@/lib/dlt/domains/bonds";

/**
 * Dummy-auction settlement: deliver bonds to the winner via primary issuance.
 * NOTE (open item): atomic bond-vs-CBDC DVP is NOT performed here — DLT API has no `affirm`
 * endpoint. Cash leg settled out-of-band in Phase 1.
 */
export async function settleAllocation(a: {
  bondId: string | null;
  winnerAddress: string;
  bondAmount: number;
}): Promise<{ steps: { issued: boolean }; result: { ok: boolean } }> {
  if (!a.bondId) throw new Error("bondId required to settle");
  const r = await bonds.issue(a.bondId, { investor: a.winnerAddress, amount: a.bondAmount });
  return { steps: { issued: true }, result: r };
}
