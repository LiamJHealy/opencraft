import raw from "@/data/seeds.json";
import { normalizeName } from "@/lib/normalize";
import { prisma } from "@/lib/prisma";

type Pair = { left: string; right: string; result: string; emoji?: string; tags?: string[] };
type Vocab = { name: string; aliases?: string[] };

type TargetSeed = {
  name: string;
  emoji?: string;
  difficulty?: string;
  recipes?: Array<{ left: string; right: string }>;
};

type SeedsDoc = {
  version?: number;
  pairs: Pair[];
  targets?: TargetSeed[];
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

const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

// normalize the file once
const rawDoc = raw as SeedsDoc | undefined;
const doc: SeedsDoc = rawDoc ?? { pairs: [] };
const pairs: Pair[] = (doc.pairs ?? []).map((p) => ({
  left: normalizeName(p.left),
  right: normalizeName(p.right),
  result: normalizeName(p.result),
  emoji: isEmojiLike(p.emoji) ? p.emoji!.trim() : undefined,
  tags: Array.isArray(p.tags) ? p.tags.map((t) => t.toLowerCase()) : undefined,
})).filter((p) => p.left && p.right && p.result);

const targets = (doc.targets ?? []).map((t) => ({
  name: normalizeName(t.name),
  emoji: isEmojiLike(t.emoji) ? t.emoji!.trim() : undefined,
  difficulty: DIFFICULTIES.has(String(t.difficulty ?? "").toLowerCase())
    ? (String(t.difficulty).toLowerCase() as "easy" | "medium" | "hard")
    : "easy",
  recipes: Array.isArray(t.recipes)
    ? t.recipes
        .map((r) => ({ left: normalizeName(r.left), right: normalizeName(r.right) }))
        .filter((r) => r.left && r.right)
    : [],
}));

const targetMap = new Map(targets.map((t) => [t.name, t]));

const vocab = (doc.vocabulary ?? []).map((v) => ({
  name: normalizeName(v.name),
  aliases: (v.aliases ?? []).map((a) => normalizeName(a)),
}));

const aliasMap = new Map<string, string>(); // alias -> canonical
for (const v of vocab) {
  for (const a of v.aliases ?? []) aliasMap.set(a, v.name);
}

// order-insensitive key
function key(a: string, b: string) {
  const A = normalizeName(a);
  const B = normalizeName(b);
  return A <= B ? `${A}::${B}` : `${B}::${A}`;
}

// fast lookup for exact seeded pair
const seedMap = new Map<string, { result: string; emoji?: string }>();
for (const p of pairs) seedMap.set(key(p.left, p.right), { result: p.result, emoji: p.emoji });

// lightweight tag index for picking examples
const tagIndex = new Map<string, Pair[]>();
for (const p of pairs) {
  for (const t of p.tags ?? ["general"]) {
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
export function pickSeedExamples(
  left: string,
  right: string,
  n = 3,
): Array<{ L: string; R: string; result: string; emoji?: string }> {
  const base = tagIndex.get("general") ?? pairs;

  const pool = base;
  const out: typeof pool = [];
  for (let i = 0; i < pool.length && out.length < n; i += 1) out.push(pool[i]);

  return out.map((p) => ({ L: p.left, R: p.right, result: p.result, emoji: p.emoji }));
}

export type TargetDefinition = ReturnType<typeof listTargets>[number];

/** Return normalized target definitions */
export function listTargets() {
  return targets;
}

export function getTarget(name: string) {
  return targetMap.get(normalizeName(name)) ?? null;
}

/** Build an avoid list from seeds + DB (near-duplicates/aliases collapsed) */
export async function buildAvoidList(left: string, right: string) {
  const L = canonicalWord(left);
  const R = canonicalWord(right);

  const avoid = new Set<string>();

  for (const p of pairs) avoid.add(p.result);

  for (const v of vocab) {
    avoid.add(v.name);
    for (const a of v.aliases ?? []) avoid.add(a);
  }

  const db = await prisma.recipe.findMany({
    where: {
      OR: [
        { left: { name: L }, right: { name: R } },
        { left: { name: R }, right: { name: L } },
      ],
    },
    include: { result: true },
  });
  for (const r of db) avoid.add(normalizeName(r.result.name));

  return Array.from(avoid);
}

