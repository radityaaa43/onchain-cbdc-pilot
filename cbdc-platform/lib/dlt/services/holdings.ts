import { db } from "@/lib/db";
import { bonds } from "@/lib/dlt/domains/bonds";

export type BondHolding = {
  instrumentId: string; bondId: string; name: string; symbol: string;
  primary: string; secondary: string; total: string;
};

export async function getBondHoldings(holder: string): Promise<BondHolding[]> {
  const instruments = await db.instrument.findMany({ where: { bondId: { not: null } } });
  const out: BondHolding[] = [];

  for (const i of instruments.filter((x) => x.bondId != null)) {
    const [p, s] = await Promise.all([
      bonds.balance(i.bondId!, holder, "PRIMARY").catch(() => ({ balance: "0" })),
      bonds.balance(i.bondId!, holder, "SECONDARY").catch(() => ({ balance: "0" })),
    ]);
    const total = (BigInt(p.balance) + BigInt(s.balance)).toString();
    out.push({ instrumentId: i.id, bondId: i.bondId!, name: i.name, symbol: i.symbol, primary: p.balance, secondary: s.balance, total });
  }
  return out;
}
