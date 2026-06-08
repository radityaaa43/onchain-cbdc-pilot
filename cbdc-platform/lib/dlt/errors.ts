export type DltErrorCode = "DLT_AUTH" | "DLT_TX" | "DLT_VALIDATION" | "DLT_NETWORK" | "DLT_UNKNOWN";

export class DltError extends Error {
  constructor(public code: DltErrorCode, public httpStatus: number, message: string, public detail?: unknown) {
    super(message);
  }
}

export function mapDltError(status: number, body: any): DltError {
  if (status === 401) return new DltError("DLT_AUTH", 502, "DLT API auth failed (server config)", body);
  if (status === 400) return new DltError("DLT_VALIDATION", 422, "DLT API validation failed", body?.error);
  if (status >= 500) {
    const msg = typeof body?.error === "string" ? body.error : "DLT transaction failed";
    return new DltError("DLT_TX", 502, msg, body);
  }
  return new DltError("DLT_UNKNOWN", 502, `Unexpected DLT status ${status}`, body);
}
