import { listTargets } from "@/lib/seeds";
import { normalizeName } from "@/lib/normalize";
import { prisma } from "@/lib/prisma";
import starterPoolRaw from "@/data/starterWords.json";

type RecipeEdge = { left: string; right: string; result: string };
type ParentMap = Map<string, { left: string; right: string }>;

type DepthMap = Map<string, number>;

const FALLBACK_EMOJI = "??";

const FALLBACK_STARTERS = ["fire", "water", "earth", "air"] as const;
const STARTER_COUNT = 4;
const MIN_TARGET_DEPTH = 3;
const MAX_STARTER_ATTEMPTS = 128;

type StarterWordEntry = string | { name?: string };

type StarterDoc = {
  starters?: StarterWordEntry[];
};

const STARTER_POOL = (() => {
  const doc = (starterPoolRaw ?? {}) as StarterDoc;
  const seen = new Set<string>();
  const names: string[] = [];
  for (const entry of doc.starters ?? []) {
    const value =
      typeof entry === "string"
        ? normalizeName(entry)
        : normalizeName(entry?.name ?? "");
    if (!value || seen.has(value)) continue;
    seen.add(value);
    names.push(value);
  }
  for (const fallback of FALLBACK_STARTERS) {
    if (names.length >= STARTER_COUNT) break;
    const normalized = normalizeName(fallback);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    names.push(normalized);
  }
  return names;
})();

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

function recipeEdgeKey(left: string, right: string, result: string) {
  const L = normalizeName(left);
  const R = normalizeName(right);
  const [a, b] = L <= R ? [L, R] : [R, L];
  return `${a}::${b}::${normalizeName(result)}`;
}
function ensureEmoji(value?: string | null) {
  return value && value.trim() ? value.trim() : FALLBACK_EMOJI;
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

type StarterInfo = { id: number; name: string; emoji: string | null; tier: number | null };

type BuildResult = {
  starters: StarterInfo[];
  target: DailyTarget;
  depths: DepthMap;
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
  const recipeLookup = new Set<string>();
  for (const edge of recipes) {
    recipeLookup.add(recipeEdgeKey(edge.left, edge.right, edge.result));
  }

  const availableTargets = listTargets().filter(
    (target) =>
      target.recipes.length >= 2 &&
      target.paths.some((path) => path.steps.length >= 3),
  );
  if (!availableTargets.length) {
    throw new Error("No targets with sufficient multi-link coverage available.");
  }

  const curatedCandidates = availableTargets.flatMap((target) =>
    target.starterSets
      .filter((set) => set.steps.length >= MIN_TARGET_DEPTH)
      .map((set) => ({ target, set })),
  );

  const createDailyTarget = (
    candidate: (typeof availableTargets)[number],
    info: StarterInfo,
    path: RecipeEdge[],
    depth: number,
    starterOrder: string[],
  ): DailyTarget => {
    const recipeSet = new Map<string, { left: string; right: string }>();
    for (const recipe of candidate.recipes) {
      const left = normalizeName(recipe.left);
      const right = normalizeName(recipe.right);
      if (!left || !right) continue;
      const key = left <= right ? `${left}::${right}` : `${right}::${left}`;
      if (!recipeSet.has(key)) {
        recipeSet.set(key, { left, right });
      }
    }
    const recipeOptions = Array.from(recipeSet.values());

    const pathOptions = candidate.paths.map((pathDef) => ({
      label: pathDef.label,
      steps: pathDef.steps.map((step) => ({
        left: step.left,
        right: step.right,
        result: step.result,
      })),
    }));

    return {
      name: candidate.name,
      elementId: info.id,
      emoji: ensureEmoji(info.emoji),
      steps: depth,
      path,
      recipes: recipeOptions,
      pathOptions,
      requiredStarters: starterOrder,
    };
  };

  const buildDailyFromStarters = (starterNames: string[]): BuildResult | null => {
    const normalized = starterNames.map((name) => normalizeName(name)).filter(Boolean);
    const uniqueNames = Array.from(new Set(normalized));
    if (uniqueNames.length < STARTER_COUNT) return null;

    const startersInfo: StarterInfo[] = [];
    for (const name of uniqueNames) {
      const info = elementByName.get(name);
      if (!info) return null;
      startersInfo.push(info);
    }

    const { depths, parent } = computeDepths(uniqueNames, recipes);

    const targetPool = [...availableTargets];
    shuffleInPlace(targetPool, rng);

    const candidate = targetPool.find((t) => {
      const depth = depths.get(t.name);
      return depth !== undefined && depth >= MIN_TARGET_DEPTH;
    });

    if (!candidate) return null;

    const depth = depths.get(candidate.name)!;
    const path = buildPath(candidate.name, parent);
    if (!path.length) return null;

    const info = elementByName.get(candidate.name);
    if (!info) return null;

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

    const targetPayload = createDailyTarget(candidate, info, path, depth, orderedStarterUse);

    return { starters: startersInfo, target: targetPayload, depths };
  };

  const buildDailyFromScenario = (
    scenario: { target: (typeof availableTargets)[number]; set: (typeof availableTargets[number]["starterSets"][number]) },
  ): BuildResult | null => {
    const starters = scenario.set.starters.map((name) => normalizeName(name)).filter(Boolean);
    const uniqueNames = Array.from(new Set(starters));
    if (uniqueNames.length < 3) return null;

    const startersInfo: StarterInfo[] = [];
    for (const name of uniqueNames) {
      const info = elementByName.get(name);
      if (!info) return null;
      startersInfo.push(info);
    }

    const { depths } = computeDepths(uniqueNames, recipes);
    const depth = depths.get(scenario.target.name);
    if (depth === undefined || depth < MIN_TARGET_DEPTH) return null;

    const steps = scenario.set.steps.map((step) => ({
      left: normalizeName(step.left),
      right: normalizeName(step.right),
      result: normalizeName(step.result),
    }));
    if (!steps.length) return null;
    if (steps[steps.length - 1].result !== scenario.target.name) return null;

    for (const step of steps) {
      if (!recipeLookup.has(recipeEdgeKey(step.left, step.right, step.result))) {
        return null;
      }
      if (depths.get(step.result) === undefined) {
        return null;
      }
    }

    const info = elementByName.get(scenario.target.name);
    if (!info) return null;

    const starterSet = new Set(uniqueNames);
    const usedStarters = new Set<string>();
    const orderedStarterUse: string[] = [];
    for (const step of steps) {
      if (starterSet.has(step.left) && !usedStarters.has(step.left)) {
        usedStarters.add(step.left);
        orderedStarterUse.push(step.left);
      }
      if (starterSet.has(step.right) && !usedStarters.has(step.right)) {
        usedStarters.add(step.right);
        orderedStarterUse.push(step.right);
      }
    }
    if (!orderedStarterUse.length) {
      orderedStarterUse.push(...uniqueNames);
    }

    const path = steps.map((step) => ({
      left: step.left,
      right: step.right,
      result: step.result,
    }));

    const targetPayload = createDailyTarget(scenario.target, info, path, depth, orderedStarterUse);

    return { starters: startersInfo, target: targetPayload, depths };
  };

  let attemptResult: BuildResult | null = null;

  if (curatedCandidates.length) {
    const scenarioPool = [...curatedCandidates];
    shuffleInPlace(scenarioPool, rng);
    for (const scenario of scenarioPool) {
      const result = buildDailyFromScenario(scenario);
      if (result) {
        attemptResult = result;
        break;
      }
    }
  }

  const starterPool = STARTER_POOL.length
    ? STARTER_POOL
    : Array.from(FALLBACK_STARTERS, (name) => normalizeName(name));
  if (starterPool.length < STARTER_COUNT) {
    throw new Error("Not enough starter words available to build a daily set.");
  }

  const pickStarterSet = () => {
    const poolCopy = [...starterPool];
    shuffleInPlace(poolCopy, rng);
    return poolCopy.slice(0, STARTER_COUNT);
  };

  if (!attemptResult) {
    const attemptLimit = Math.max(MAX_STARTER_ATTEMPTS, starterPool.length * 2);

    for (let i = 0; i < attemptLimit; i += 1) {
      const starterNames = pickStarterSet();
      const result = buildDailyFromStarters(starterNames);
      if (result) {
        attemptResult = result;
        break;
      }
    }

    if (!attemptResult) {
      const fallbackNames = Array.from(FALLBACK_STARTERS, (name) => normalizeName(name));
      attemptResult = buildDailyFromStarters(fallbackNames);
    }
  }

  if (!attemptResult) {
    throw new Error("Unable to generate daily target with available starters.");
  }

  const { starters, target, depths } = attemptResult;

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
    targets: [target],
    reachableCount: depths.size,
  };
}

