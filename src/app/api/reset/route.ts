import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";
import { pairKey } from "@/lib/text";

// Seed data (lowercase internally)
const STARTERS = ["fire", "water", "earth", "wind"] as const;

// Core recipes using "wind" (not "air")
const CORE: Array<[string, string, string]> = [
  ["fire", "water", "steam"],
  ["earth", "water", "mud"],
  ["earth", "fire", "lava"],
  ["wind", "earth", "dust"],
  ["wind", "water", "rain"],
  ["wind", "fire", "energy"],
];

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Reset disabled in production" }, { status: 403 });
  }

  // wipe tables (recipes reference elements, so delete recipes first)
  await prisma.recipe.deleteMany({});
  await prisma.element.deleteMany({});

  // upsert all elements (starters + results)
  const allElementNames = new Set<string>(STARTERS);
  for (const [, , res] of CORE) allElementNames.add(res);

  const elementIdByName = new Map<string, number>();
  for (const rawName of allElementNames) {
    const name = normalizeName(rawName);
    const el = await prisma.element.create({ data: { name } });
    elementIdByName.set(name, el.id);
  }

  // create recipes (order-agnostic)
  for (const [l, r, res] of CORE) {
    const leftId = elementIdByName.get(normalizeName(l))!;
    const rightId = elementIdByName.get(normalizeName(r))!;
    const resultId = elementIdByName.get(normalizeName(res))!;
    await prisma.recipe.create({ data: { leftId, rightId, resultId } });
  }

  return Response.json(
    {
      ok: true,
      starters: STARTERS,
      recipes: CORE.map(([a, b, c]) => ({ a, b, c })),
      count: { elements: elementIdByName.size, recipes: CORE.length },
    },
    { status: 200 }
  );
}
