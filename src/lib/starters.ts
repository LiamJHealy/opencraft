import raw from "@/data/starters.json";
import { normalizeName } from "@/lib/normalize";

type Starter = { name: string; emoji?: string };
type Config = {
  mode?: "static" | "daily";
  count?: number;
  starters: Starter[];
};

const cfg = (raw as Config) ?? { starters: [] };
const COUNT = Math.max(1, Math.min(12, cfg.count ?? 4));

/** deterministic PRNG from a string seed (date) */
function xmur3a(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickDaily<T>(arr: T[], k: number, seed: string): T[] {
  const r = mulberry32(xmur3a(seed)());
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(k, a.length));
}

/** Normalize names & lightly validate emoji */
function isEmojiLike(s?: string) {
  if (!s) return false;
  const t = s.trim();
  if (!t || /[A-Za-z0-9]/.test(t) || t.length > 10) return false;
  return /\p{Extended_Pictographic}/u.test(t);
}

function sanitize(starters: Starter[]): Starter[] {
  return starters
    .map(s => ({
      name: normalizeName(s.name),
      emoji: isEmojiLike(s.emoji) ? s.emoji!.trim() : undefined,
    }))
    .filter(s => !!s.name);
}

/** Public API */
export function getStartersForToday(date = new Date()): Starter[] {
  const all = sanitize(cfg.starters);
  if (cfg.mode === "daily") {
    const seed = date.toISOString().slice(0, 10); // YYYY-MM-DD
    return pickDaily(all, COUNT, seed);
  }
  return all.slice(0, COUNT);
}
