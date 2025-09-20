// src/app/api/auth/forgot/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptPassword } from "@/lib/auth/crypto";
import { sendMail } from "@/lib/mail";

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return NextResponse.json({ ok: true }); // do not leak
  try {
    const pw = decryptPassword(user.passwordEnc, user.passwordIv, user.passwordTag);
    const html = `
      <p>Hi ${user.alias || "there"},</p>
      <p>Your OpenCraft password is:</p>
      <p><b>${pw}</b></p>
      <p>If this wasn't you, contact support.</p>
    `;
    await sendMail(user.email, "Your OpenCraft password", html);
  } catch {
    // If decryption fails, still respond OK (avoid leakage)
  }
  return NextResponse.json({ ok: true });
}
