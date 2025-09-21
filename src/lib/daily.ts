import type { Prisma } from "@prisma/client";

import { normalizeName } from "@/lib/normalize";
import { prisma } from "@/lib/prisma";

const FALLBACK_EMOJI = "🤔";
const FALLBACK_STARTERS = ["fire", "water", "earth", "air"] as const;
const REQUIRED_STARTER_COUNT = 4;
const DEFAULT_MIN_DEPTH = (() => {
  const raw = process.env.DAILY_MIN_BACKTRACK_DEPTH ?? process.env.DAILY_MIN_DEPTH ?? "3";
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 3;
})();

type RecipeEdge = { left: string; right: string; result: string };
type ParentMap = Map<string, { left: string; right: string }>;
type DepthMap = Map<string, number>;
type GraphWord = {
  id: number;
  name: string;
  normalized: string;
  emoji: string | null;
  tier: number | null;
  isStarter: boolean;
};

function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function seed() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(a: number) {
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function computeDepths(starters: string[], recipes: RecipeEdge[]) {
  const depths: DepthMap = new Map();
  const parent: ParentMap = new Map();

  for (const starter of starters) depths.set(starter, 0);

  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of recipes) {
      const leftDepth = depths.get(edge.left);
      const rightDepth = depths.get(edge.right);
      if (leftDepth === undefined || rightDepth === undefined) continue;
      const candidate = Math.max(leftDepth, rightDepth) + 1;
      const current = depths.get(edge.result);
      if (current === undefined || candidate < current) {
        depths.set(edge.result, candidate);
        parent.set(edge.result, { left: edge.left, right: edge.right });
        changed = true;
      }
    }
  }

  return { depths, parent };
}

function buildPath(target: string, parent: ParentMap) {
  const steps: RecipeEdge[] = [];
  const visited = new Set<string>();

  function visit(current: string) {
    if (visited.has(current)) return;
    const combo = parent.get(current);
    if (!combo) return;
    visit(combo.left);
    visit(combo.right);
    steps.push({ left: combo.left, right: combo.right, result: current });
    visited.add(current);
  }

  visit(target);
  return steps;
}

function ensureEmoji(value?: string | null) {
  return value && value.trim() ? value.trim() : FALLBACK_EMOJI;
}

function canonicalSeed(seedInput?: string) {
  const base = seedInput && seedInput.trim() ? seedInput.trim() : new Date().toISOString().slice(0, 10);
  return base.toLowerCase();
}

function parseStarterIds(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      .map((value) => Math.trunc(value));
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return parseStarterIds(parsed);
    } catch (error) {
      return [];
    }
  }
  return [];
}

function deriveRequiredStarters(path: RecipeEdge[], depths: DepthMap) {
  const required = new Set<string>();
  for (const step of path) {
    if (depths.get(step.left) === 0) required.add(step.left);
    if (depths.get(step.right) === 0) required.add(step.right);
  }
  return Array.from(required);
}

function collectPathWords(path: RecipeEdge[]) {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const step of path) {
    if (!seen.has(step.left)) {
      names.push(step.left);
      seen.add(step.left);
    }
    if (!seen.has(step.right)) {
      names.push(step.right);
      seen.add(step.right);
    }
  }
  return names;
}

function chooseStarterWordIds(
  requiredNames: string[],
  starterPool: GraphWord[],
  pathNames: string[],
  wordByName: Map<string, GraphWord>,
  limit = REQUIRED_STARTER_COUNT,
) {
  const selected: GraphWord[] = [];
  const seen = new Set<number>();

  const pushWord = (word: GraphWord | undefined | null) => {
    if (!word || seen.has(word.id)) return;
    selected.push(word);
    seen.add(word.id);
  };

  const pushByName = (name: string) => {
    const normalized = normalizeName(name);
    pushWord(wordByName.get(normalized));
  };

  for (const name of requiredNames) pushByName(name);
  for (const starter of starterPool) {
    pushWord(starter);
    if (selected.length >= limit) break;
  }
  if (selected.length < limit) {
    for (const name of pathNames) {
      pushByName(name);
      if (selected.length >= limit) break;
    }
  }
  if (selected.length < limit) {
    for (const word of wordByName.values()) {
      pushWord(word);
      if (selected.length >= limit) break;
    }
  }

  return selected.slice(0, limit).map((word) => word.id);
}

export type DailyTarget = {
  name: string;
  elementId: number;
  emoji: string;
  steps: number;
  path: RecipeEdge[];
  recipes: Array<{ left: string; right: string }>;
  pathOptions: Array<{ label: string; steps: RecipeEdge[] }>;
  requiredStarters: string[];
};

export type DailyPayload = {
  seed: string;
  starters: Array<{ id: number; name: string; emoji: string; tier: number | null }>;
  starterCount: number;
  targets: DailyTarget[];
  reachableCount: number;
};

export async function generateDailySet(seedInput?: string, options?: { minDepth?: number }): Promise<DailyPayload> {
  const canonical = canonicalSeed(seedInput);
  const depthRequirement = Math.max(options?.minDepth ?? DEFAULT_MIN_DEPTH, 1);
  const rng = mulberry32(xmur3(canonical)());

  const existingRun = await prisma.dailyTargetHistory.findUnique({ where: { seed: canonical } });

  const [wordRows, recipeRows] = await Promise.all([
    prisma.word.findMany({
      select: { id: true, name: true, emoji: true, tier: true, isStarter: true },
      orderBy: { name: "asc" },
    }),
    prisma.recipeEdge.findMany({
      where: { source: { in: ["CANON", "MANUAL"] } },
      select: {
        left: { select: { name: true } },
        right: { select: { name: true } },
        result: { select: { name: true } },
      },
    }),
  ]);

  if (!wordRows.length) {
    throw new Error("Word graph is empty. Seed the database before generating a daily set.");
  }

  const graphWords: GraphWord[] = wordRows.map((row) => ({
    id: row.id,
    name: row.name,
    normalized: normalizeName(row.name),
    emoji: row.emoji,
    tier: row.tier ?? null,
    isStarter: row.isStarter,
  }));

  const wordByName = new Map(graphWords.map((word) => [word.normalized, word]));
  const wordById = new Map(graphWords.map((word) => [word.id, word]));

  const starterSet = new Set<string>();
  const starterPool: GraphWord[] = [];
  for (const word of graphWords) {
    if (!word.isStarter) continue;
    if (starterSet.has(word.normalized)) continue;
    starterSet.add(word.normalized);
    starterPool.push(word);
  }
  for (const fallback of FALLBACK_STARTERS) {
    const normalized = normalizeName(fallback);
    if (starterSet.has(normalized)) continue;
    const word = wordByName.get(normalized);
    if (!word) continue;
    starterSet.add(normalized);
    starterPool.push(word);
  }
  if (!starterPool.length) {
    throw new Error("No starter words available in the graph.");
  }

  const recipes: RecipeEdge[] = recipeRows.map((row) => ({
    left: normalizeName(row.left.name),
    right: normalizeName(row.right.name),
    result: normalizeName(row.result.name),
  }));

  const edgesByResult = new Map<string, RecipeEdge[]>();
  for (const edge of recipes) {
    if (!edgesByResult.has(edge.result)) edgesByResult.set(edge.result, []);
    edgesByResult.get(edge.result)!.push(edge);
  }

  const starterNames = starterPool.map((word) => word.normalized);
  const { depths, parent } = computeDepths(starterNames, recipes);
  const reachableCount = depths.size;

  const now = new Date();
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  let targetWord: GraphWord | null = null;
  let targetDepth = depthRequirement;
  let starterWordIds: number[] = [];

  if (existingRun) {
    targetWord = wordById.get(existingRun.targetId) ?? null;
    targetDepth = Math.max(existingRun.maxDepth ?? depthRequirement, 1);
    starterWordIds = parseStarterIds(existingRun.starterWordIds);
  }

  if (!targetWord) {
    const recentHistory = await prisma.dailyTargetHistory.findMany({
      where: { selectedOn: { gte: windowStart } },
      select: { targetId: true },
    });
    const recentTargetIds = new Set(recentHistory.map((entry) => entry.targetId));

    const candidates = graphWords
      .filter((word) => {
        const depth = depths.get(word.normalized);
        if (depth === undefined || depth < depthRequirement) return false;
        if (!edgesByResult.has(word.normalized)) return false;
        return true;
      })
      .sort((a, b) => a.normalized.localeCompare(b.normalized));

    if (!candidates.length) {
      throw new Error("No candidate targets satisfy the depth requirement.");
    }

    let pool = candidates.filter((word) => !recentTargetIds.has(word.id));
    if (!pool.length) pool = candidates;

    const choiceIndex = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    targetWord = pool[choiceIndex];
    targetDepth = depthRequirement;
  }

  if (!targetWord) {
    throw new Error("Failed to resolve a target word for the daily set.");
  }

  const targetName = targetWord.normalized;
  const depthValue = depths.get(targetName);
  if (depthValue === undefined || depthValue < targetDepth) {
    throw new Error(`Target word '${targetWord.name}' is not reachable within the required depth.`);
  }

  const path = buildPath(targetName, parent);
  if (!path.length) {
    throw new Error(`No recipe path found for target word '${targetWord.name}'.`);
  }

  const requiredStarters = deriveRequiredStarters(path, depths);
  const pathNames = collectPathWords(path);

  if (!starterWordIds.length) {
    starterWordIds = chooseStarterWordIds(requiredStarters, starterPool, pathNames, wordByName);
    try {
      await prisma.dailyTargetHistory.create({
        data: {
          seed: canonical,
          targetId: targetWord.id,
          maxDepth: targetDepth,
          starterWordIds,
        },
      });
    } catch (error) {
      const knownError = error as Prisma.PrismaClientKnownRequestError;
      if (knownError?.code === "P2002") {
        const fallback = await prisma.dailyTargetHistory.findUnique({ where: { seed: canonical } });
        if (fallback) {
          starterWordIds = parseStarterIds(fallback.starterWordIds);
        }
      } else {
        throw error;
      }
    }
  }

  if (!starterWordIds.length) {
    starterWordIds = chooseStarterWordIds(requiredStarters, starterPool, pathNames, wordByName);
  }

  const starters = starterWordIds
    .map((id) => wordById.get(id))
    .filter((word): word is GraphWord => Boolean(word))
    .map((word) => ({
      id: word.id,
      name: word.normalized,
      emoji: ensureEmoji(word.emoji),
      tier: word.tier,
    }));

  const seenPairs = new Set<string>();
  const recipePairs: Array<{ left: string; right: string }> = [];
  for (const step of path) {
    const key = `${step.left}::${step.right}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    recipePairs.push({ left: step.left, right: step.right });
  }

  const targetPayload: DailyTarget = {
    name: targetWord.normalized,
    elementId: targetWord.id,
    emoji: ensureEmoji(targetWord.emoji),
    steps: path.length,
    path,
    recipes: recipePairs,
    pathOptions: [{ label: "Shortest path", steps: path }],
    requiredStarters,
  };

  return {
    seed: canonical,
    starters,
    starterCount: starters.length,
    targets: [targetPayload],
    reachableCount,
  };
}
