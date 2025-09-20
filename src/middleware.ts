// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: ["/play/:path*", "/catalog/:path*"], // protect these
};

export function middleware(req: NextRequest) {
  const cookie = req.cookies.get("oc_sess")?.value;
  if (!cookie) return NextResponse.redirect(new URL("/login", req.url));
  // We only check presence; session validity is enforced in server loaders
  return NextResponse.next();
}
