import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";

const STARTERS = ["fire", "water", "earth", "air"] as const;
const CORE: Array<[string, string, string]> = [
  ["fire", "water", "steam"],
  ["earth", "water", "mud"],
  ["earth", "fire", "lava"],
  ["air", "earth", "dust"],
  ["air", "water", "rain"],
  ["air", "fire", "energy"],
];

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Reset disabled in production" }, { status: 403 });
  }

  await prisma.recipeEdge.deleteMany({});
  await prisma.word.deleteMany({});

  const allNames = new Set<string>(STARTERS);
  for (const [, , result] of CORE) allNames.add(result);

  const wordIdByName = new Map<string, number>();
  for (const rawName of allNames) {
    const name = normalizeName(rawName);
    const word = await prisma.word.create({
      data: {
        name,
        isStarter: STARTERS.includes(name as typeof STARTERS[number]),
        isGoal: false,
      },
    });
    wordIdByName.set(name, word.id);
  }

  for (const [left, right, result] of CORE) {
    const leftId = wordIdByName.get(normalizeName(left));
    const rightId = wordIdByName.get(normalizeName(right));
    const resultId = wordIdByName.get(normalizeName(result));
    if (!leftId || !rightId || !resultId) continue;
    await prisma.recipeEdge.create({
      data: {
        leftId,
        rightId,
        resultId,
        source: "CANON",
        isDefault: true,
      },
    });
  }

  return Response.json(
    {
      ok: true,
      starters: STARTERS,
      recipes: CORE.map(([a, b, c]) => ({ a, b, c })),
      count: { words: wordIdByName.size, recipes: CORE.length },
    },
    { status: 200 }
  );
}
