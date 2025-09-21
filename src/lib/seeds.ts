import raw from "@/data/seeds.json";
import targetDbRaw from "@/data/targetDatabase.json";
import { normalizeName } from "@/lib/normalize";
import { prisma } from "@/lib/prisma";

type Pair = { left: string; right: string; result: string; emoji?: string; tags?: string[] };
type Vocab = { name: string; aliases?: string[] };

type TargetSeed = {
  name: string;
  emoji?: string;
  recipes?: Array<{ left?: string; right?: string } | [string, string]>;
};

type SeedsDoc = {
  version?: number;
  pairs: Pair[];
  targets?: TargetSeed[];
  vocabulary?: Vocab[];
  constraints?: { blocklistResults?: string[]; maxResultLen?: number };
};

type TargetDbStep = { result?: string; left?: string; right?: string };
type TargetDbPath = { label?: string; steps?: TargetDbStep[] };
type TargetDbStarterSet = {
  label?: string;
  starters?: Array<string | null | undefined>;
  path?: string;
  steps?: TargetDbStep[];
};
type TargetDbEntry = {
  name?: string;
  emoji?: string;
  paths?: TargetDbPath[];
  starterSets?: TargetDbStarterSet[];
};

type TargetDbDoc = {
  version?: number;
  targets?: TargetDbEntry[];
};

type PathStep = { result: string; left: string; right: string };
type TargetPath = { label: string; steps: PathStep[] };
type Recipe = { left: string; right: string };

export type TargetStarterSet = {
  label: string;
  starters: string[];
  pathLabel?: string;
  steps: PathStep[];
};

export type TargetDefinition = {
  name: string;
  emoji?: string;
  recipes: Recipe[];
  paths: TargetPath[];
  starterSets: TargetStarterSet[];
};

function isEmojiLike(s?: string) {
  if (!s) return false;
  const t = s.trim();
  if (!t || /[A-Za-z0-9]/.test(t) || t.length > 10) return false;
  return /\p{Extended_Pictographic}/u.test(t);
}

function normalizeWord(value: unknown) {
  if (typeof value !== "string") return "";
  return normalizeName(value);
}

function recipeKey(left: string, right: string) {
  return `${left}::${right}`;
}

function normalizeRecipeInput(input: unknown): Recipe | null {
  if (!input) return null;
  if (Array.isArray(input)) {
    if (input.length < 2) return null;
    const left = normalizeWord(input[0]);
    const right = normalizeWord(input[1]);
    if (left && right) return { left, right };
    return null;
  }
  if (typeof input === "object") {
    const obj = input as { left?: string; right?: string };
    const left = normalizeWord(obj.left);
    const right = normalizeWord(obj.right);
    if (left && right) return { left, right };
  }
  return null;
}

function normalizeDbStep(step: TargetDbStep): PathStep | null {
  const result = normalizeWord(step?.result);
  const left = normalizeWord(step?.left);
  const right = normalizeWord(step?.right);
  if (!result || !left || !right) return null;
  return { result, left, right };
}

function cloneSteps(steps: PathStep[]): PathStep[] {
  return steps.map((step) => ({
    result: step.result,
    left: step.left,
    right: step.right,
  }));
}

function inferStartersFromPath(path: TargetPath) {
  const produced = new Set<string>();
  const starters = new Set<string>();
  for (const step of path.steps) {
    if (!produced.has(step.left)) starters.add(step.left);
    if (!produced.has(step.right)) starters.add(step.right);
    produced.add(step.result);
    starters.delete(step.result);
  }
  return Array.from(starters);
}

const rawDoc = raw as SeedsDoc | undefined;
const doc: SeedsDoc = rawDoc ?? { pairs: [] };
const pairs: Pair[] = (doc.pairs ?? [])
  .map((p) => ({
    left: normalizeName(p.left),
    right: normalizeName(p.right),
    result: normalizeName(p.result),
    emoji: isEmojiLike(p.emoji) ? p.emoji!.trim() : undefined,
    tags: Array.isArray(p.tags) ? p.tags.map((t) => t.toLowerCase()) : undefined,
  }))
  .filter((p) => p.left && p.right && p.result);

const legacyTargets = new Map<string, { name: string; emoji?: string; recipes: Recipe[] }>();
for (const entry of doc.targets ?? []) {
  const name = normalizeWord(entry?.name);
  if (!name) continue;
  const emoji = isEmojiLike(entry?.emoji) ? entry!.emoji!.trim() : undefined;
  const recipes: Recipe[] = [];
  const recipeMap = new Map<string, Recipe>();
  for (const rawRecipe of entry.recipes ?? []) {
    const normalized = normalizeRecipeInput(rawRecipe);
    if (!normalized) continue;
    const key = recipeKey(normalized.left, normalized.right);
    if (!recipeMap.has(key)) recipeMap.set(key, normalized);
  }
  recipes.push(...recipeMap.values());
  legacyTargets.set(name, { name, emoji, recipes });
}

const dbDoc = (targetDbRaw as TargetDbDoc) ?? { targets: [] };
const targets: TargetDefinition[] = [];
const targetMap = new Map<string, TargetDefinition>();

for (const [index, entry] of (dbDoc.targets ?? []).entries()) {
  const name = normalizeWord(entry?.name);
  if (!name || targetMap.has(name)) continue;
  const emoji = isEmojiLike(entry?.emoji) ? entry!.emoji!.trim() : undefined;
  const pathList: TargetPath[] = [];
  const recipeMap = new Map<string, Recipe>();
  const paths = Array.isArray(entry?.paths) ? entry.paths : [];
  paths.forEach((path, pathIndex) => {
    const label = typeof path?.label === "string" && path.label.trim()
      ? path.label.trim()
      : 'path-' + (index + 1) + '-' + (pathIndex + 1);
    const stepsRaw = Array.isArray(path?.steps) ? path.steps : [];
    const steps: PathStep[] = [];
    for (const step of stepsRaw) {
      const normalized = normalizeDbStep(step);
      if (!normalized) continue;
      steps.push(normalized);
      if (normalized.result === name) {
        const key = recipeKey(normalized.left, normalized.right);
        if (!recipeMap.has(key)) recipeMap.set(key, { left: normalized.left, right: normalized.right });
      }
    }
    if (steps.length) {
      pathList.push({ label, steps });
    }
  });

  const pathIndex = new Map<string, TargetPath>();
  for (const p of pathList) {
    pathIndex.set(p.label.toLowerCase(), p);
  }

  const starterSets: TargetStarterSet[] = [];
  const starterKeySet = new Set<string>();

  const addStarterSet = (set: TargetStarterSet) => {
    const stepsClone = cloneSteps(set.steps);
    if (!stepsClone.length) return;
    const terminal = stepsClone[stepsClone.length - 1];
    if (normalizeWord(terminal?.result) !== name) return;

    const normalizedStarters = Array.from(
      new Set(
        set.starters
          .map((value) => normalizeWord(value))
          .filter((value): value is string => !!value)
      )
    );

    if (normalizedStarters.length < 3 || normalizedStarters.length > 5) return;

    const pathLabel = set.pathLabel && set.pathLabel.trim() ? set.pathLabel.trim() : undefined;
    const key = normalizedStarters.join("::") + "::" + (pathLabel ?? "");
    if (starterKeySet.has(key)) return;
    starterKeySet.add(key);

    starterSets.push({
      label: set.label,
      starters: normalizedStarters,
      pathLabel,
      steps: stepsClone,
    });
  };

  const rawStarterSets = Array.isArray(entry?.starterSets) ? entry.starterSets : [];
  rawStarterSets.forEach((rawSet, setIndex) => {
    const label =
      typeof rawSet?.label === "string" && rawSet.label.trim()
        ? rawSet.label.trim()
        : name + " starter " + (setIndex + 1);
    const startersInput = Array.isArray(rawSet?.starters) ? rawSet.starters : [];
    const starters = startersInput.filter((value): value is string => typeof value === "string");
    let steps: PathStep[] | null = null;
    let pathLabel: string | undefined;

    if (typeof rawSet?.path === "string" && rawSet.path.trim()) {
      const ref = pathIndex.get(rawSet.path.trim().toLowerCase());
      if (ref) {
        steps = ref.steps;
        pathLabel = ref.label;
      }
    }

    if (!steps && Array.isArray(rawSet?.steps)) {
      const normalizedSteps: PathStep[] = [];
      for (const step of rawSet.steps) {
        const normalized = normalizeDbStep(step);
        if (normalized) normalizedSteps.push(normalized);
      }
      if (normalizedSteps.length) {
        steps = normalizedSteps;
      }
    }

    if (!steps && pathList.length) {
      steps = pathList[0].steps;
      pathLabel = pathList[0].label;
    }

    if (!steps) return;
    addStarterSet({ label, starters, pathLabel, steps });
  });

  if (!starterSets.length) {
    pathList.forEach((path) => {
      const starters = inferStartersFromPath(path);
      if (!starters.length) return;
      addStarterSet({
        label: path.label + " starters",
        starters,
        pathLabel: path.label,
        steps: path.steps,
      });
    });
  }

  const record: TargetDefinition = {
    name,
    emoji,
    recipes: Array.from(recipeMap.values()),
    paths: pathList,
    starterSets,
  };
  targets.push(record);
  targetMap.set(name, record);
}

for (const [name, legacy] of legacyTargets) {
  const existing = targetMap.get(name);
  if (existing) {
    if (!existing.emoji && legacy.emoji) existing.emoji = legacy.emoji;
    if (legacy.recipes.length) {
      const recipeSet = new Map<string, Recipe>();
      for (const recipe of existing.recipes) recipeSet.set(recipeKey(recipe.left, recipe.right), recipe);
      for (const recipe of legacy.recipes) {
        const key = recipeKey(recipe.left, recipe.right);
        if (!recipeSet.has(key)) recipeSet.set(key, recipe);
      }
      existing.recipes = Array.from(recipeSet.values());
    }
  } else {
    const record: TargetDefinition = {
      name,
      emoji: legacy.emoji,
      recipes: legacy.recipes,
      paths: [],
      starterSets: [],
    };
    targets.push(record);
    targetMap.set(name, record);
  }
}

const vocab = (doc.vocabulary ?? []).map((v) => ({
  name: normalizeName(v.name),
  aliases: (v.aliases ?? []).map((a) => normalizeName(a)),
}));

const aliasMap = new Map<string, string>();
for (const v of vocab) {
  for (const a of v.aliases ?? []) aliasMap.set(a, v.name);
}

function key(a: string, b: string) {
  const A = normalizeName(a);
  const B = normalizeName(b);
  return A <= B ? `${A}::${B}` : `${B}::${A}`;
}

const seedMap = new Map<string, { result: string; emoji?: string }>();
for (const p of pairs) seedMap.set(key(p.left, p.right), { result: p.result, emoji: p.emoji });

const tagIndex = new Map<string, Pair[]>();
for (const p of pairs) {
  for (const t of p.tags ?? ["general"]) {
    const k = t.toLowerCase();
    if (!tagIndex.has(k)) tagIndex.set(k, []);
    tagIndex.get(k)!.push(p);
  }
}

export function canonicalWord(w: string) {
  const n = normalizeName(w);
  return aliasMap.get(n) ?? n;
}

export function findSeed(left: string, right: string) {
  return seedMap.get(key(left, right)) ?? null;
}

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

export function listTargets() {
  return targets;
}

export function getTarget(name: string) {
  return targetMap.get(normalizeName(name)) ?? null;
}

export async function buildAvoidList(left: string, right: string) {
  const L = canonicalWord(left);
  const R = canonicalWord(right);

  const avoid = new Set<string>();

  for (const p of pairs) avoid.add(p.result);

  for (const v of vocab) {
    avoid.add(v.name);
    for (const a of v.aliases ?? []) avoid.add(a);
  }

  const db = await prisma.recipeEdge.findMany({
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
