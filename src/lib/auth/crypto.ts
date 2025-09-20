// src/lib/auth/crypto.ts
import crypto from "crypto";
import bcrypt from "bcryptjs";

const ALGO = "aes-256-gcm";

function getKey() {
  const raw = process.env.AUTH_SECRET;
  if (!raw) throw new Error("AUTH_SECRET missing");
  // Derive a 32-byte key from AUTH_SECRET (supports hex/base64/utf8)
  // If it's already 32 bytes base64/hex, decode; else hash.
  try {
    if (/^[A-Fa-f0-9]+$/.test(raw) && raw.length === 64) {
      return Buffer.from(raw, "hex");
    }
    const b = Buffer.from(raw, "base64");
    if (b.length === 32) return b;
  } catch {}
  return crypto.createHash("sha256").update(raw).digest(); // 32 bytes
}

export async function hashPassword(pw: string) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(pw, salt);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export function encryptPassword(plaintext: string) {
  const key = getKey();
  const iv = crypto.randomBytes(12); // GCM 96-bit IV
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    enc: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptPassword(encB64: string, ivB64: string, tagB64: string) {
  const key = getKey();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
