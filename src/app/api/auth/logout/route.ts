// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";
export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
