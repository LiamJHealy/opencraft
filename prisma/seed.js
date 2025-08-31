// prisma/seed.js
// CommonJS so it runs with `node prisma/seed.js`

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Starters and core recipes — all lowercase; UI handles display formatting
const STARTERS = ["fire", "water", "earth", "wind"];
const CORE = [
  ["fire", "water", "steam"],
  ["earth", "water", "mud"],
  ["earth", "fire", "lava"],
  ["wind", "earth", "dust"],
  ["wind", "water", "rain"],
  ["wind", "fire", "energy"],
];

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

async function upsertElement(name) {
  const n = norm(name);
  return prisma.element.upsert({
    where: { name: n },
    update: {},
    create: { name: n },
  });
}

async function main() {
  // Upsert all elements we need (starters + core results)
  const idByName = new Map();
  for (const n of STARTERS) {
    const el = await upsertElement(n);
    idByName.set(el.name, el.id);
  }
  for (const [, , res] of CORE) {
    const el = await upsertElement(res);
    idByName.set(el.name, el.id);
  }

  // Ensure each core recipe exists and is marked CANON.
  // If a recipe exists with the same pair but a different result, update it to the canonical result.
  for (const [lRaw, rRaw, resRaw] of CORE) {
    const l = norm(lRaw);
    const r = norm(rRaw);
    const res = norm(resRaw);

    const leftId = idByName.get(l) ?? (await upsertElement(l)).id;
    const rightId = idByName.get(r) ?? (await upsertElement(r)).id;
    const resultId = idByName.get(res) ?? (await upsertElement(res)).id;

    // Find any existing recipe for this unordered pair
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
    } else if (existing.resultId !== resultId) {
      // Update to canonical result if needed
      await prisma.recipe.update({
        where: { id: existing.id },
        data: { resultId, source: "CANON" },
      });
    } else {
      // Ensure source is set to CANON when it matches already
      if (existing.source !== "CANON") {
        await prisma.recipe.update({
          where: { id: existing.id },
          data: { source: "CANON" },
        });
      }
    }
  }

  console.log("Seed complete: starters + canonical core recipes");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
