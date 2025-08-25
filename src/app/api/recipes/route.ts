import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";

export async function GET() {
  const recipes = await prisma.recipe.findMany({
    orderBy: { id: "asc" },
    include: { left: true, right: true, result: true },
  });

  // Present friendly names
  return Response.json(
    recipes.map((r) => ({
      id: r.id,
      left: r.left.name,
      right: r.right.name,
      result: r.result.name,
      createdAt: r.createdAt,
    })),
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const leftIn  = typeof body?.left === "string"  ? body.left  : "";
    const rightIn = typeof body?.right === "string" ? body.right : "";
    const resIn   = typeof body?.result === "string"? body.result: "";

    const leftName   = normalizeName(leftIn);
    const rightName  = normalizeName(rightIn);
    const resultName = normalizeName(resIn);

    if (!leftName || !rightName || !resultName) {
      return Response.json({ error: "left, right, result are required strings" }, { status: 400 });
    }

    // Ensure elements exist (create if missing)
    const [leftEl, rightEl, resultEl] = await Promise.all([
      prisma.element.upsert({ where: { name: leftName },   update: {}, create: { name: leftName } }),
      prisma.element.upsert({ where: { name: rightName },  update: {}, create: { name: rightName } }),
      prisma.element.upsert({ where: { name: resultName }, update: {}, create: { name: resultName } }),
    ]);

    // Prevent duplicate recipe (order-insensitive)
    const existing = await prisma.recipe.findFirst({
      where: {
        OR: [
          { leftId: leftEl.id,  rightId: rightEl.id, resultId: resultEl.id },
          { leftId: rightEl.id, rightId: leftEl.id, resultId: resultEl.id },
        ],
      },
    });
    if (existing) return Response.json({ id: existing.id, status: "exists" }, { status: 200 });

    const rec = await prisma.recipe.create({
      data: { leftId: leftEl.id, rightId: rightEl.id, resultId: resultEl.id },
    });

    return Response.json({ id: rec.id, status: "created" }, { status: 201 });
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
}
