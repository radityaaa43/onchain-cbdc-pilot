import PaladinClient, { PenteFactory, PentePrivacyGroup } from "@lfdecentralizedtrust/paladin-sdk";
import { config } from "./config";
import { ABI } from "./abi";

let _group: PentePrivacyGroup | null = null;

export async function getGroup(): Promise<PentePrivacyGroup> {
  if (_group) return _group;
  const paladin = new PaladinClient({ url: config.paladinUrl });
  const pente = new PenteFactory(paladin, "pente");
  const group = await pente.resumePrivacyGroup({ id: config.groupId });
  if (!group) throw new Error(`Pente group not found: ${config.groupId}`);
  _group = group;
  return group;
}

export async function tx(
  to: string,
  fn: string,
  data: Record<string, unknown>
): Promise<void> {
  const group = await getGroup();
  const receipt = await group
    .sendTransaction({ from: config.paladinFrom, to, methodAbi: ABI[fn], data })
    .waitForReceipt(config.waitMs, true);
  if (!receipt?.success)
    throw new Error(`TX failed [${fn}]: ${JSON.stringify(receipt?.failureMessage ?? "timeout")}`);
}

export async function txWithLogs(
  to: string,
  fn: string,
  data: Record<string, unknown>
): Promise<{ logs: Array<{ topics: string[] }> }> {
  const group = await getGroup();
  const receipt = await group
    .sendTransaction({ from: config.paladinFrom, to, methodAbi: ABI[fn], data })
    .waitForReceipt(config.waitMs, true);
  if (!receipt?.success)
    throw new Error(`TX failed [${fn}]: ${JSON.stringify(receipt?.failureMessage ?? "timeout")}`);
  const logs = (receipt as any)?.domainReceipt?.receipt?.logs ?? [];
  return { logs };
}

export async function call(
  to: string,
  fn: string,
  data: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const group = await getGroup();
  return group.call({ from: config.paladinFrom, to, methodAbi: ABI[fn], data }) as Promise<Record<string, unknown>>;
}
