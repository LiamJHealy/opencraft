const path = require("path");
const fs = require("fs/promises");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const FALLBACK_EMOJI = "??";
const DEFAULT_GRAPH_PATH = path.resolve(__dirname, "../src/data/defaultRecipeGraph.json");
const MANUAL_GRAPH_PATH = path.resolve(__dirname, "../src/data/manualRecipes.json");

function normalizeName(input) {
  return String(input ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function isEmojiLike(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || /[A-Za-z0-9]/.test(trimmed) || trimmed.length > 10) return false;
  return /\p{Extended_Pictographic}/u.test(trimmed);
}

function canonicalPair(a, b) {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return [left, right];
  return left <= right ? [left, right] : [right, left];
}

function recipeKey(left, right, result) {
  const [a, b] = canonicalPair(left, right);
  const target = normalizeName(result);
  if (!a || !b || !target) return null;
  return `${a}::${b}::${target}`;
}

async function readJson(filePath) {
  try {
    let raw = await fs.readFile(filePath, "utf-8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

async function loadGraph(filePath, defaults) {
  const doc = await readJson(filePath);
  if (!doc || typeof doc !== "object") {
    return { words: [], recipes: [], defaults };
  }

  const words = [];
  const entries = Array.isArray(doc.words) ? doc.words : [];
  for (const entry of entries) {
    const name = normalizeName(entry?.name);
    if (!name) continue;
    const emoji = isEmojiLike(entry?.emoji) ? entry.emoji.trim() : undefined;
    const category = typeof entry?.category === "string" && entry.category.trim() ? entry.category.trim() : undefined;
    const tier = Number.isFinite(entry?.tier) ? Math.max(0, Math.round(entry.tier)) : undefined;
    const starter = entry?.starter === true;
    const goal = entry?.goal === true;
    words.push({ name, emoji, category, tier, starter, goal });
  }

  const recipes = [];
  const rawRecipes = Array.isArray(doc.recipes) ? doc.recipes : [];
  for (const entry of rawRecipes) {
    const result = normalizeName(entry?.result);
    const leftRaw = normalizeName(entry?.left);
    const rightRaw = normalizeName(entry?.right);
    if (!result || !leftRaw || !rightRaw) continue;
    const [left, right] = canonicalPair(leftRaw, rightRaw);
    const emoji = isEmojiLike(entry?.emoji) ? entry.emoji.trim() : undefined;
    const category = typeof entry?.category === "string" && entry.category.trim() ? entry.category.trim() : undefined;
    const source = typeof entry?.source === "string" && entry.source.trim()
      ? entry.source.trim().toUpperCase()
      : defaults.source;
    const isDefault = entry?.isDefault !== undefined ? !!entry.isDefault : !!defaults.isDefault;
    recipes.push({
      left,
      right,
      result,
      emoji,
      category,
      source,
      isDefault,
      origin: defaults.origin,
    });
  }

  return { words, recipes, defaults };
}

function mergeGraphDocs(docs) {
  const wordMeta = new Map();
  const recipeMap = new Map();

  for (const doc of docs) {
    for (const word of doc.words) {
      const meta = wordMeta.get(word.name) ?? {};
      if (word.emoji) meta.emoji = word.emoji;
      if (word.category) meta.category = word.category;
      if (word.tier !== undefined) meta.tier = word.tier;
      if (word.starter !== undefined) meta.isStarter = !!word.starter;
      if (word.goal !== undefined) meta.isGoal = !!word.goal;
      wordMeta.set(word.name, meta);
    }

    for (const recipe of doc.recipes) {
      const key = recipeKey(recipe.left, recipe.right, recipe.result);
      if (!key) continue;
      const existing = recipeMap.get(key) ?? {};
      const merged = {
        left: recipe.left,
        right: recipe.right,
        result: recipe.result,
        category: recipe.category ?? existing.category ?? null,
        emoji: recipe.emoji ?? existing.emoji ?? null,
        source: recipe.source ?? existing.source ?? (recipe.isDefault ? "CANON" : "MANUAL"),
        isDefault: recipe.isDefault ?? existing.isDefault ?? false,
        origin: recipe.origin ?? existing.origin ?? "unknown",
      };
      recipeMap.set(key, merged);

      if (!wordMeta.has(recipe.left)) wordMeta.set(recipe.left, {});
      if (!wordMeta.has(recipe.right)) wordMeta.set(recipe.right, {});
      const resultMeta = wordMeta.get(recipe.result) ?? {};
      if (recipe.emoji && !resultMeta.emoji) resultMeta.emoji = recipe.emoji;
      if (recipe.category && !resultMeta.category) resultMeta.category = recipe.category;
      wordMeta.set(recipe.result, resultMeta);
    }
  }

  return { wordMeta, recipeMap };
}

function computeTiers(recipes, starters) {
  const tiers = new Map();
  for (const starter of starters) tiers.set(starter, 0);

  if (!recipes.length) return tiers;

  let changed = true;
  let guard = 0;
  const recipeList = recipes.map((entry) => ({ ...entry }));

  while (changed) {
    changed = false;
    guard += 1;
    if (guard > recipeList.length * 8) break;

    for (const recipe of recipeList) {
      const leftTier = tiers.get(recipe.left);
      const rightTier = tiers.get(recipe.right);
      if (leftTier === undefined || rightTier === undefined) continue;
      const candidate = Math.max(leftTier, rightTier) + 1;
      const current = tiers.get(recipe.result);
      if (current === undefined || candidate < current) {
        tiers.set(recipe.result, candidate);
        changed = true;
      }
    }
  }

  return tiers;
}

async function upsertWords(wordMeta, tiers) {
  const idByName = new Map();
  const missingEmoji = [];

  for (const [name, meta] of wordMeta.entries()) {
    const tier = meta.tier !== undefined ? meta.tier : tiers.get(name);
    const isStarter = !!meta.isStarter;
    const defaultGoal = tier !== undefined && tier !== null ? tier >= 3 : false;
    const isGoal = meta.isGoal !== undefined ? !!meta.isGoal : (defaultGoal && !isStarter);
    const hasEmoji = meta.emoji && isEmojiLike(meta.emoji);

    const record = await prisma.word.upsert({
      where: { name },
      update: {
        ...(hasEmoji ? { emoji: meta.emoji.trim() } : {}),
        category: meta.category ?? null,
        tier: tier ?? null,
        isStarter,
        isGoal,
      },
      create: {
        name,
        emoji: hasEmoji ? meta.emoji.trim() : FALLBACK_EMOJI,
        category: meta.category ?? null,
        tier: tier ?? null,
        isStarter,
        isGoal,
      },
    });

    if (!hasEmoji && (!record.emoji || record.emoji === FALLBACK_EMOJI)) {
      missingEmoji.push(name);
    }

    idByName.set(name, record.id);
  }

  return { idByName, missingEmoji };
}

async function upsertRecipes(recipeMap, idByName) {
  let created = 0;
  let updated = 0;
  const issues = [];

  for (const recipe of recipeMap.values()) {
    const leftId = idByName.get(recipe.left);
    const rightId = idByName.get(recipe.right);
    const resultId = idByName.get(recipe.result);
    if (!leftId || !rightId || !resultId) {
      issues.push(`${recipe.left} + ${recipe.right} -> ${recipe.result}`);
      continue;
    }

    const data = {
      category: recipe.category ?? null,
      source: recipe.source ?? (recipe.isDefault ? "CANON" : "MANUAL"),
      isDefault: !!recipe.isDefault,
    };

    const record = await prisma.recipeEdge.upsert({
      where: {
        leftId_rightId_resultId: {
          leftId,
          rightId,
          resultId,
        },
      },
      update: data,
      create: {
        leftId,
        rightId,
        resultId,
        ...data,
      },
    });

    if (record.createdAt.getTime() === record.updatedAt.getTime()) {
      created += 1;
    } else {
      updated += 1;
    }
  }

  return { created, updated, issues };
}

async function main() {
  const [defaultGraph, manualGraph] = await Promise.all([
    loadGraph(DEFAULT_GRAPH_PATH, { isDefault: true, source: "CANON", origin: "default" }),
    loadGraph(MANUAL_GRAPH_PATH, { isDefault: false, source: "MANUAL", origin: "manual" }),
  ]);

  const { wordMeta, recipeMap } = mergeGraphDocs([defaultGraph, manualGraph]);

  const starters = Array.from(wordMeta.entries())
    .filter(([, meta]) => meta.isStarter)
    .map(([name]) => name);

  if (!starters.length) {
    throw new Error("At least one starter word must be defined in the graph data.");
  }

  const tiers = computeTiers(Array.from(recipeMap.values()), starters);
  const { idByName, missingEmoji } = await upsertWords(wordMeta, tiers);
  const { created, updated, issues } = await upsertRecipes(recipeMap, idByName);

  const reachableCount = tiers.size;
  const totalWords = idByName.size;
  const totalRecipes = recipeMap.size;

  if (missingEmoji.length) {
    const preview = missingEmoji.slice(0, 10).join(", ");
    const suffix = missingEmoji.length > 10 ? ", ..." : "";
    console.warn(`Assigned fallback emoji to ${missingEmoji.length} words: ${preview}${suffix}`);
  }

  if (issues.length) {
    const sample = issues.slice(0, 5).join("; ");
    const suffix = issues.length > 5 ? "; ..." : "";
    console.warn(`Skipped ${issues.length} recipes due to missing words: ${sample}${suffix}`);
  }

  console.log(
    `Seeded word graph with ${totalWords} words, ${totalRecipes} recipes (created ${created}, updated ${updated}), reachable words: ${reachableCount}.`
  );
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
