// prisma/seed.js
// Run with: npx prisma db seed
// (CommonJS so it runs with `node prisma/seed.js`)

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

// -------- Starters (with emojis) --------
const STARTERS = [
  ["fire",  "🔥"],
  ["water", "💧"],
  ["earth", "🌍"],
  ["wind",  "🌬️"],
];

// -------- Canonical core recipes --------
const CORE = [
  ["fire", "water", "steam"],
  ["earth", "water", "mud"],
  ["earth", "fire", "lava"],
  ["wind", "earth", "dust"],
  ["wind", "water", "rain"],
  ["wind", "fire", "energy"],
];

// Recommended emojis for core results
// Notes:
// - steam: ♨️ (“hot springs” symbol, widely used to denote steam) or 🫧 (bubbles). Picked ♨️ for clarity.
// - mud: 🟫 (brown square) — simple and readable; alternatives are limited for “mud”.
// - lava: 🌋 (volcano)
// - dust: 💨 (dashing away) — conveys dust puff; alternative 🌫️ (fog) looks broader.
// - rain: 🌧️ (cloud with rain)
// - energy: ⚡ (high voltage)
const CORE_EMOJI = {
  steam:  "♨️",
  mud:    "🟫",
  lava:   "🌋",
  dust:   "💨",
  rain:   "🌧️",
  energy: "⚡",
};

async function upsertElement(name, emoji) {
  const n = norm(name);
  return prisma.element.upsert({
    where: { name: n },
    update: emoji ? { emoji } : {},
    create: emoji ? { name: n, emoji } : { name: n },
  });
}

async function main() {
  // 1) Seed starters (with emojis)
  const idByName = new Map();
  for (const [name, emoji] of STARTERS) {
    const el = await upsertElement(name, emoji);
    idByName.set(el.name, el.id);
  }

  // 2) Ensure core result elements exist (with emojis)
  for (const [, , res] of CORE) {
    const emoji = CORE_EMOJI[norm(res)];
    const el = await upsertElement(res, emoji);
    idByName.set(el.name, el.id);
  }

  // 3) Ensure core left/right elements exist too (in case not covered above)
  for (const [l, r] of CORE) {
    if (!idByName.has(norm(l))) {
      const el = await upsertElement(l);
      idByName.set(el.name, el.id);
    }
    if (!idByName.has(norm(r))) {
      const el = await upsertElement(r);
      idByName.set(el.name, el.id);
    }
  }

  // 4) Create or update canonical recipes
  for (const [lRaw, rRaw, resRaw] of CORE) {
    const l = norm(lRaw);
    const r = norm(rRaw);
    const res = norm(resRaw);

    const leftId   = idByName.get(l);
    const rightId  = idByName.get(r);
    const resultId = idByName.get(res);

    const existing = await prisma.recipe.findFirst({
      where: {
        OR: [
          { leftId, rightId },
          { leftId: rightId, rightId: leftId },
        ],
      },
    });

    if (!existing) {
      await prisma.recipe.create({
        data: { leftId, rightId, resultId, source: "CANON" },
      });
    } else if (existing.resultId !== resultId || existing.source !== "CANON") {
      await prisma.recipe.update({
        where: { id: existing.id },
        data: { resultId, source: "CANON" },
      });
    }
  }

  console.log("Seed complete: starters + canonical core recipes + emojis");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
