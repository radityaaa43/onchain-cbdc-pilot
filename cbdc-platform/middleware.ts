import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) return;
  if (!req.auth) return NextResponse.redirect(new URL("/login", req.url));

  const role = process.env.APP_ROLE;
  if (pathname.startsWith("/admin") && role !== "operator")
    return NextResponse.redirect(new URL("/", req.url));
  if (pathname.startsWith("/participant") && role !== "participant")
    return NextResponse.redirect(new URL("/", req.url));
});

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
