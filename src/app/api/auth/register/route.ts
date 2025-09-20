// src/app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptPassword, hashPassword } from "@/lib/auth/crypto";
import { createSession } from "@/lib/auth/session";

export async function POST(req: Request) {
  const { email, alias, password } = await req.json().catch(() => ({}));
  if (!email || !alias || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  // Basic constraints
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 chars" }, { status: 400 });
  }
  // Create both hash and encrypted copy
  const [passwordHash, enc] = await Promise.all([
    hashPassword(password),
    (async () => encryptPassword(password))(),
  ]);

  try {
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        alias,
        passwordHash,
        passwordEnc: enc.enc,
        passwordIv: enc.iv,
        passwordTag: enc.tag,
      },
    });
    await createSession(user.id);
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, alias: user.alias } });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "Email or alias already in use" }, { status: 409 });
    }
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
