import raw from "@/data/seeds.json";
import { normalizeName } from "@/lib/normalize";
import { prisma } from "@/lib/prisma";

type Pair = { left: string; right: string; result: string; emoji?: string; tags?: string[] };
type Vocab = { name: string; aliases?: string[] };

type SeedsDoc = {
  version?: number;
  pairs: Pair[];
  vocabulary?: Vocab[];
  constraints?: { blocklistResults?: string[]; maxResultLen?: number };
};

// basic emoji check (same flavor as elsewhere)
function isEmojiLike(s?: string) {
  if (!s) return false;
  const t = s.trim();
  if (!t || /[A-Za-z0-9]/.test(t) || t.length > 10) return false;
  return /\p{Extended_Pictographic}/u.test(t);
}

// normalize the file once
const doc: SeedsDoc = (raw as any) ?? { pairs: [] };
const pairs: Pair[] = (doc.pairs ?? []).map(p => ({
  left: normalizeName(p.left),
  right: normalizeName(p.right),
  result: normalizeName(p.result),
  emoji: isEmojiLike(p.emoji) ? p.emoji!.trim() : undefined,
  tags: Array.isArray(p.tags) ? p.tags.map(t => t.toLowerCase()) : undefined,
})).filter(p => p.left && p.right && p.result);

const vocab = (doc.vocabulary ?? []).map(v => ({
  name: normalizeName(v.name),
  aliases: (v.aliases ?? []).map(a => normalizeName(a)),
}));

const aliasMap = new Map<string, string>(); // alias -> canonical
for (const v of vocab) {
  for (const a of (v.aliases ?? [])) aliasMap.set(a, v.name);
}

// order-insensitive key
function key(a: string, b: string) {
  const A = normalizeName(a), B = normalizeName(b);
  return A <= B ? `${A}::${B}` : `${B}::${A}`;
}

// fast lookup for exact seeded pair
const seedMap = new Map<string, { result: string; emoji?: string }>();
for (const p of pairs) seedMap.set(key(p.left, p.right), { result: p.result, emoji: p.emoji });

// lightweight tag index for picking examples
const tagIndex = new Map<string, Pair[]>();
for (const p of pairs) {
  for (const t of (p.tags ?? ["general"])) {
    const k = t.toLowerCase();
    if (!tagIndex.has(k)) tagIndex.set(k, []);
    tagIndex.get(k)!.push(p);
  }
}

/** Canonicalize by alias if present */
export function canonicalWord(w: string) {
  const n = normalizeName(w);
  return aliasMap.get(n) ?? n;
}

/** Return a curated seed result for the pair if it exists */
export function findSeed(left: string, right: string) {
  return seedMap.get(key(left, right)) ?? null;
}

/** Pick N example pairs near the topic (very simple heuristic) */
export function pickSeedExamples(left: string, right: string, n = 3): Array<{L:string;R:string;result:string;emoji?:string}> {
  const base = tagIndex.get("general") ?? pairs;

  // naive: use any; later you can tag-match on left/right
  const pool = base;
  const out: typeof pool = [];
  for (let i = 0; i < pool.length && out.length < n; i++) out.push(pool[i]);

  return out.map(p => ({ L: p.left, R: p.right, result: p.result, emoji: p.emoji }));
}

/** Build an avoid list from seeds + DB (near-duplicates/aliases collapsed) */
export async function buildAvoidList(left: string, right: string) {
  const L = canonicalWord(left);
  const R = canonicalWord(right);

  const avoid = new Set<string>();

  // add all seed results globally (keeps style & avoids repeats)
  for (const p of pairs) avoid.add(p.result);

  // add aliases as avoid too
  for (const v of vocab) {
    avoid.add(v.name);
    for (const a of (v.aliases ?? [])) avoid.add(a);
  }

  // add DB results for either order of the pair
  const db = await prisma.recipe.findMany({
    where: {
      OR: [
        { left: { name: L },  right: { name: R } },
        { left: { name: R },  right: { name: L } },
      ],
    },
    include: { result: true },
  });
  for (const r of db) avoid.add(normalizeName(r.result.name));

  return Array.from(avoid);
}
