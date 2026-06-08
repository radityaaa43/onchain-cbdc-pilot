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
    cbdcRedemption:   required("CONTRACT_CBDC_REDEMPTION_SERVICE"),
    cbdcBalanceLimit: required("CONTRACT_CBDC_BALANCE_LIMIT_SERVICE"),
    cbdcDailyLimit:   required("CONTRACT_CBDC_DAILY_LIMIT_SERVICE"),
    // Bond lifecycle
    couponService:      required("CONTRACT_COUPON_SERVICE"),
    couponCalculator:   required("CONTRACT_COUPON_CALCULATOR"),
    maturityService:    required("CONTRACT_MATURITY_SERVICE"),
    maturityOracle:     required("CONTRACT_MATURITY_ORACLE"),
    bondRedemption:     required("CONTRACT_BOND_REDEMPTION_SERVICE"),
    transferService:    required("CONTRACT_TRANSFER_SERVICE"),
    corporateAction:    required("CONTRACT_CORPORATE_ACTION_SERVICE"),
    // Bond advanced
    custodyService:     required("CONTRACT_CUSTODY_SERVICE"),
    pledgeService:      required("CONTRACT_PLEDGE_SERVICE"),
    repoService:        required("CONTRACT_REPO_SERVICE"),
    securitiesLending:  required("CONTRACT_SECURITIES_LENDING_SERVICE"),
    // Compliance
    complianceService:  required("CONTRACT_COMPLIANCE_SERVICE"),
    dfabiCompliance:    required("CONTRACT_DFABI_COMPLIANCE_SERVICE"),
    shariahCompliance:  required("CONTRACT_SHARIAH_COMPLIANCE_SERVICE"),
    policyEngine:       required("CONTRACT_POLICY_ENGINE_SERVICE"),
    // Infrastructure
    netting:            required("CONTRACT_NETTING_SERVICE"),
    oracle:             required("CONTRACT_ORACLE_SERVICE"),
    reporting:          required("CONTRACT_REPORTING_SERVICE"),
    tokenGateway:       required("CONTRACT_CBDC_TOKEN_GATEWAY_SERVICE"),
    settlementFailure:  required("CONTRACT_SETTLEMENT_FAILURE_SERVICE"),
    assetRegistry:      required("CONTRACT_ASSET_REGISTRY"),
  },
} as const;
