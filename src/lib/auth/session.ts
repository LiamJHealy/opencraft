// src/lib/auth/session.ts
import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const COOKIE = "oc_sess";
const COOKIE_TTL_DAYS = 30;

function sign(value: string) {
  const secret = process.env.AUTH_SECRET!;
  const mac = crypto.createHmac("sha256", secret).update(value).digest("base64url");
  return `${value}.${mac}`;
}
function verify(signed: string) {
  const i = signed.lastIndexOf(".");
  if (i < 0) return null;
  const value = signed.slice(0, i);
  const mac = signed.slice(i + 1);
  const expect = crypto.createHmac("sha256", process.env.AUTH_SECRET!).update(value).digest("base64url");
  return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect)) ? value : null;
}

export async function createSession(userId: string) {
  const expires = new Date(Date.now() + COOKIE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: { userId, expiresAt: expires },
  });
  const cookie = await cookies();
  cookie.set({
    name: COOKIE,
    value: sign(session.id),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires,
  });
}

export async function destroySession() {
  const cookie = await cookies();
  const raw = cookie.get(COOKIE)?.value;
  if (raw) {
    const id = verify(raw);
    if (id) await prisma.session.delete({ where: { id } }).catch(() => {});
  }
  cookie.set(COOKIE, "", { path: "/", httpOnly: true, maxAge: 0 });
}

export async function getSessionUser() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const id = verify(raw);
  if (!id) return null;
  const sess = await prisma.session.findUnique({ where: { id } });
  if (!sess) return null;
  if (sess.expiresAt.getTime() < Date.now()) return null;
  const user = await prisma.user.findUnique({ where: { id: sess.userId } });
  if (!user) return null;
  return { id: user.id, email: user.email, alias: user.alias };
}
