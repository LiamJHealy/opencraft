import { listTargets } from "@/lib/seeds";
import { normalizeName } from "@/lib/normalize";
import { prisma } from "@/lib/prisma";

type RecipeEdge = { left: string; right: string; result: string };
type ParentMap = Map<string, { left: string; right: string }>;

type DepthMap = Map<string, number>;

const FALLBACK_EMOJI = "🧩";
const STARTER_NAMES = ["fire", "water", "earth", "air"] as const;
const DIFFICULTY_PLAN = [
  { level: "easy" as const, min: 3, max: 3 },
  { level: "medium" as const, min: 5, max: 5 },
  { level: "hard" as const, min: 6, max: Number.POSITIVE_INFINITY },
];

function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rng: () => number) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function computeDepths(starters: string[], recipes: RecipeEdge[]) {
  const depths: DepthMap = new Map();
  const parent: ParentMap = new Map();

  for (const name of starters) depths.set(name, 0);

  let updated = true;
  while (updated) {
    updated = false;
    for (const { left, right, result } of recipes) {
      const leftDepth = depths.get(left);
      const rightDepth = depths.get(right);
      if (leftDepth === undefined || rightDepth === undefined) continue;
      const candidate = Math.max(leftDepth, rightDepth) + 1;
      const current = depths.get(result);
      if (current === undefined || candidate < current) {
        depths.set(result, candidate);
        parent.set(result, { left, right });
        updated = true;
      }
    }
  }

  return { depths, parent };
}

function buildPath(target: string, parent: ParentMap) {
  const steps: RecipeEdge[] = [];
  const visited = new Set<string>();

  function visit(name: string) {
    if (visited.has(name)) return;
    const combo = parent.get(name);
    if (!combo) return;
    visit(combo.left);
    visit(combo.right);
    steps.push({ left: combo.left, right: combo.right, result: name });
    visited.add(name);
  }

  visit(target);
  return steps;
}

function ensureEmoji(value?: string | null) {
  return value && value.trim() ? value.trim() : FALLBACK_EMOJI;
}

export type DailyTarget = {
  difficulty: "easy" | "medium" | "hard";
  name: string;
  elementId: number;
  emoji: string;
  steps: number;
  path: RecipeEdge[];
  recipes: Array<{ left: string; right: string }>;
  requiredStarters: string[];
};

export type DailyPayload = {
  seed: string;
  starters: Array<{ id: number; name: string; emoji: string; tier: number | null }>;
  starterCount: number;
  targets: DailyTarget[];
  reachableCount: number;
};

export async function generateDailySet(seedInput?: string): Promise<DailyPayload> {
  const canonicalSeed = (seedInput && seedInput.trim()) || new Date().toISOString().slice(0, 10);
  const seedFn = xmur3(canonicalSeed.toLowerCase());
  const rng = mulberry32(seedFn());

  const elements = await prisma.element.findMany({
    select: { id: true, name: true, emoji: true, tier: true },
  });
  const elementByName = new Map(
    elements.map((el) => [normalizeName(el.name), { ...el, name: normalizeName(el.name) }]),
  );

  const starters = STARTER_NAMES.map((name) => {
    const info = elementByName.get(name);
    if (!info) {
      throw new Error(`Missing starter element '${name}' in database.`);
    }
    return info;
  });

  const recipesRows = await prisma.recipe.findMany({
    where: { source: { in: ["CANON", "MANUAL"] } },
    select: {
      left: { select: { name: true } },
      right: { select: { name: true } },
      result: { select: { name: true } },
    },
  });
  const recipes: RecipeEdge[] = recipesRows.map((row) => ({
    left: normalizeName(row.left.name),
    right: normalizeName(row.right.name),
    result: normalizeName(row.result.name),
  }));

  const starterNames = starters.map((s) => s.name);
  const { depths, parent } = computeDepths(starterNames, recipes);

  const targets = listTargets();
  const shuffledTargets = [...targets];
  shuffleInPlace(shuffledTargets, rng);

  const chosenTargets: DailyTarget[] = [];
  const usedNames = new Set<string>();

  for (const plan of DIFFICULTY_PLAN) {
    const candidate = shuffledTargets.find((t) => {
      if (t.difficulty !== plan.level) return false;
      if (usedNames.has(t.name)) return false;
      const depth = depths.get(t.name);
      if (depth === undefined) return false;
      return depth >= plan.min && depth <= plan.max;
    });

    if (!candidate) {
      throw new Error(`No candidate target found for difficulty '${plan.level}'.`);
    }

    const depth = depths.get(candidate.name)!;
    const path = buildPath(candidate.name, parent);
    if (!path.length) {
      throw new Error(`No recipe path found for target '${candidate.name}'.`);
    }

    const info = elementByName.get(candidate.name);
    if (!info) {
      throw new Error(`Missing element metadata for target '${candidate.name}'.`);
    }

    const starterUse = new Set<string>();
    const orderedStarterUse: string[] = [];
    for (const step of path) {
      if (depths.get(step.left) === 0 && !starterUse.has(step.left)) {
        starterUse.add(step.left);
        orderedStarterUse.push(step.left);
      }
      if (depths.get(step.right) === 0 && !starterUse.has(step.right)) {
        starterUse.add(step.right);
        orderedStarterUse.push(step.right);
      }
    }

    chosenTargets.push({
      difficulty: plan.level,
      name: candidate.name,
      elementId: info.id,
      emoji: ensureEmoji(info.emoji),
      steps: depth,
      path,
      recipes: candidate.recipes,
      requiredStarters: orderedStarterUse,
    });
    usedNames.add(candidate.name);
  }

  const startersPayload = starters.map((info) => ({
    id: info.id,
    name: info.name,
    emoji: ensureEmoji(info.emoji),
    tier: info.tier,
  }));

  return {
    seed: canonicalSeed,
    starters: startersPayload,
    starterCount: startersPayload.length,
    targets: chosenTargets,
    reachableCount: depths.size,
  };
}
