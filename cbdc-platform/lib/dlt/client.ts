import "server-only";
import { env } from "@/lib/env";
import { mapDltError, DltError } from "./errors";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${env.DLT_API_URL}${path}`, {
      method,
      headers: { "content-type": "application/json", "x-api-key": env.DLT_API_KEY },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (e) {
    throw new DltError("DLT_NETWORK", 502, "DLT API unreachable", String(e));
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw mapDltError(res.status, json);
  return json as T;
}

export const dltGet = <T>(path: string) => request<T>("GET", path);
export const dltTx = <T>(path: string, body: unknown) => request<T>("POST", path, body);
