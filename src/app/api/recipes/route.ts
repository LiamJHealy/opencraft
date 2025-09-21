import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";

export async function GET() {
  const recipes = await prisma.recipeEdge.findMany({
    orderBy: { id: "asc" },
    include: { left: true, right: true, result: true },
  });

  return Response.json(
    recipes.map((recipe) => ({
      id: recipe.id,
      left: recipe.left.name,
      right: recipe.right.name,
      result: recipe.result.name,
      createdAt: recipe.createdAt,
      category: recipe.category,
      source: recipe.source,
    })),
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const leftIn = typeof body?.left === "string" ? body.left : "";
    const rightIn = typeof body?.right === "string" ? body.right : "";
    const resIn = typeof body?.result === "string" ? body.result : "";

    const leftName = normalizeName(leftIn);
    const rightName = normalizeName(rightIn);
    const resultName = normalizeName(resIn);

    if (!leftName || !rightName || !resultName) {
      return Response.json({ error: "left, right, result are required strings" }, { status: 400 });
    }

    const [leftWord, rightWord, resultWord] = await Promise.all([
      prisma.word.upsert({ where: { name: leftName }, update: {}, create: { name: leftName } }),
      prisma.word.upsert({ where: { name: rightName }, update: {}, create: { name: rightName } }),
      prisma.word.upsert({ where: { name: resultName }, update: {}, create: { name: resultName } }),
    ]);

    const existing = await prisma.recipeEdge.findFirst({
      where: {
        OR: [
          { leftId: leftWord.id, rightId: rightWord.id, resultId: resultWord.id },
          { leftId: rightWord.id, rightId: leftWord.id, resultId: resultWord.id },
        ],
      },
    });
    if (existing) return Response.json({ id: existing.id, status: "exists" }, { status: 200 });

    const created = await prisma.recipeEdge.create({
      data: {
        leftId: leftWord.id,
        rightId: rightWord.id,
        resultId: resultWord.id,
        source: "MANUAL",
        isDefault: false,
      },
    });

    return Response.json({ id: created.id, status: "created" }, { status: 201 });
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
}
