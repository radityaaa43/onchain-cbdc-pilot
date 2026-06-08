import { auth } from "@/lib/auth/config";

export async function getSession() {
  const s = await auth();
  if (!s?.user) throw new AuthError("Not authenticated", 401);
  return s.user;
}

export class AuthError extends Error {
  constructor(message: string, public httpStatus: number) { super(message); }
}
