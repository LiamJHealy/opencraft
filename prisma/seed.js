// prisma/seed.js

const path = require("path");
const fs = require("fs/promises");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

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

async function loadSeeds() {
  const seedPath = path.resolve(__dirname, "../src/data/seeds.json");
  const raw = await fs.readFile(seedPath, "utf-8");
  const doc = JSON.parse(raw);
  if (!doc || typeof doc !== "object") {
    throw new Error("seeds.json did not contain an object");
  }

  const rawPairs = Array.isArray(doc.pairs) ? doc.pairs : [];
  const elementsMeta = new Map();
  const seen = new Set();
  const pairs = [];

  for (const entry of rawPairs) {
    const left = normalizeName(entry?.left);
    const right = normalizeName(entry?.right);
    const result = normalizeName(entry?.result);
    if (!left || !right || !result) continue;

    const key = left <= right ? `${left}::${right}::${result}` : `${right}::${left}::${result}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate seed pair detected for ${left} + ${right} -> ${result}`);
    }
    seen.add(key);

    const emoji = isEmojiLike(entry?.emoji) ? entry.emoji.trim() : null;
    pairs.push({ left, right, result, emoji });

    const names = [left, right, result];
    for (const name of names) {
      if (!elementsMeta.has(name)) elementsMeta.set(name, {});
    }
    if (emoji) {
      const meta = elementsMeta.get(result) ?? {};
      if (!meta.emoji) meta.emoji = emoji;
      elementsMeta.set(result, meta);
    }
  }

  const rawElements = Array.isArray(doc.elements) ? doc.elements : [];
  for (const entry of rawElements) {
    const name = normalizeName(entry?.name);
    if (!name) continue;
    const meta = elementsMeta.get(name) ?? {};
    if (isEmojiLike(entry?.emoji)) meta.emoji = entry.emoji.trim();
    if (typeof entry?.starter === "boolean") meta.isStarter = entry.starter;
    if (typeof entry?.tier === "number" && Number.isFinite(entry.tier)) {
      meta.tier = Math.max(0, Math.round(entry.tier));
    }
    if (typeof entry?.goal === "boolean") meta.isGoal = entry.goal;
    elementsMeta.set(name, meta);
  }

  return { pairs, elementsMeta };
}

async function upsertElements(pairs, elementsMeta) {
  const names = new Set();
  const idByName = new Map();
  const missingEmoji = [];

  for (const { left, right, result, emoji } of pairs) {
    names.add(left);
    names.add(right);
    names.add(result);
    if (emoji) {
      const meta = elementsMeta.get(result) ?? {};
      if (!meta.emoji) meta.emoji = emoji;
      elementsMeta.set(result, meta);
    }
  }
  for (const name of elementsMeta.keys()) names.add(name);

  const sortedNames = Array.from(names).sort();

  for (const name of sortedNames) {
    const meta = elementsMeta.get(name) ?? {};
    let emoji = meta.emoji;
    if (!isEmojiLike(emoji)) {
      emoji = null;
    }

    const existing = await prisma.element.findUnique({ where: { name } });
    const createEmoji = emoji ?? "🧩";
    const updateEmoji = emoji ? emoji : (!existing?.emoji ? "🧩" : undefined);
    if (!emoji) missingEmoji.push(name);

    const createData = {
      name,
      emoji: createEmoji,
      isStarter: !!meta.isStarter,
      isGoal: meta.isGoal ?? false,
    };
    if (meta.tier !== undefined && meta.tier !== null) {
      createData.tier = Math.max(0, Math.round(meta.tier));
    }

    const updateData = {
      isStarter: !!meta.isStarter,
      isGoal: meta.isGoal ?? false,
    };
    if (meta.tier !== undefined && meta.tier !== null) {
      updateData.tier = Math.max(0, Math.round(meta.tier));
    }
    if (updateEmoji) {
      updateData.emoji = updateEmoji;
    }

    const element = await prisma.element.upsert({
      where: { name },
      create: createData,
      update: updateData,
    });

    idByName.set(name, element.id);
    meta.emoji = element.emoji ?? createEmoji;
    elementsMeta.set(name, meta);
  }

  return { idByName, missingEmoji };
}

async function upsertRecipes(pairs, idByName) {
  await prisma.recipe.deleteMany({ where: { source: "CANON" } });

  for (const { left, right, result } of pairs) {
    const leftId = idByName.get(left);
    const rightId = idByName.get(right);
    const resultId = idByName.get(result);

    if (!leftId || !rightId || !resultId) {
      throw new Error(`Missing element id when creating recipe: ${left} + ${right} -> ${result}`);
    }

    await prisma.recipe.create({
      data: {
        leftId,
        rightId,
        resultId,
        source: "CANON",
      },
    });
  }
}

function computeTiers(pairs, elementsMeta) {
  const tiers = new Map();
  const starters = new Set();
  for (const [name, meta] of elementsMeta.entries()) {
    if (meta.isStarter) starters.add(name);
  }
  if (!starters.size) {
    throw new Error("No starter elements defined in seeds.json elements[].");
  }
  for (const name of starters) tiers.set(name, 0);

  let changed = true;
  while (changed) {
    changed = false;
    for (const { left, right, result } of pairs) {
      const leftTier = tiers.get(left);
      const rightTier = tiers.get(right);
      if (leftTier === undefined || rightTier === undefined) continue;
      const candidate = Math.max(leftTier, rightTier) + 1;
      if (!tiers.has(result) || candidate < tiers.get(result)) {
        tiers.set(result, candidate);
        changed = true;
      }
    }
  }

  return { tiers, starters };
}

async function applyElementMetadata(idByName, elementsMeta, tiers) {
  for (const [name, id] of idByName.entries()) {
    const meta = elementsMeta.get(name) ?? {};
    const computed = tiers.get(name);
    const tierValue = computed !== undefined
      ? Math.max(0, Math.round(computed))
      : (typeof meta.tier === "number" ? Math.max(0, Math.round(meta.tier)) : null);
    const isGoal = meta.isGoal !== undefined ? meta.isGoal : (tierValue !== null && tierValue >= 3);

    await prisma.element.update({
      where: { id },
      data: {
        tier: tierValue,
        isStarter: !!meta.isStarter,
        isGoal,
      },
    });

    meta.tier = tierValue;
    meta.isGoal = isGoal;
    elementsMeta.set(name, meta);
  }
}

async function main() {
  const { pairs, elementsMeta } = await loadSeeds();
  if (!pairs.length) {
    console.warn("No seed pairs found; skipping seed process");
    return;
  }

  const { idByName, missingEmoji } = await upsertElements(pairs, elementsMeta);
  await upsertRecipes(pairs, idByName);

  const { tiers, starters } = computeTiers(pairs, elementsMeta);
  await applyElementMetadata(idByName, elementsMeta, tiers);

  if (missingEmoji.length) {
    console.warn(
      `Assigned fallback 🧩 emoji to ${missingEmoji.length} elements: ${missingEmoji.slice(0, 20).join(", ")}${missingEmoji.length > 20 ? ", ..." : ""}`
    );
  }

  const reachableCount = tiers.size;
  const totalElements = idByName.size;
  console.log(
    `Seeded ${pairs.length} canonical recipes spanning ${totalElements} elements (starters: ${starters.size}, reachable (including starters): ${reachableCount}).`
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



