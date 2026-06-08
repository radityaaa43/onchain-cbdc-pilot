import * as fs from "fs";
import * as path from "path";

function readEnvFile(): Record<string, string> {
  const envPath = path.resolve(__dirname, "../../.env.local");
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0) out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

const env = readEnvFile();

function required(key: string): string {
  const v = env[key] ?? process.env[key];
  if (!v) throw new Error(`Missing config: ${key}`);
  return v;
}

export const config = {
  paladinUrl:   process.env.PALADIN_URL   ?? "http://localhost:31548",
  paladinFrom:  process.env.PALADIN_FROM  ?? "cbdc-pilot@node1",
  apiKey:       process.env.API_KEY       ?? "dev-key",
  port:         Number(process.env.PORT   ?? 3000),
  waitMs:       300_000,

  groupId:      required("PENTE_GROUP_ADDRESS"),
  admin:        required("PENTE_FROM_ADDR"),

  contracts: {
    cbToken:        required("CONTRACT_CBTOKEN"),
    fiToken:        required("CONTRACT_FIXED_INCOME_TOKEN"),
    lifecycle:      required("CONTRACT_LIFECYCLE_MANAGER"),
    bondMetadata:   required("CONTRACT_BOND_METADATA_REGISTRY"),
    dvp:            required("CONTRACT_DVP_SERVICE"),
    cbdcIssuance:   required("CONTRACT_CBDC_ISSUANCE_SERVICE"),
    cbdcTransfer:   required("CONTRACT_CBDC_TRANSFER_SERVICE"),
    bondIssuance:   required("CONTRACT_BOND_ISSUANCE_SERVICE"),
  },
} as const;
