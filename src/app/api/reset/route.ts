import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";

const STARTERS = ["fire", "water", "earth", "air"];

export async function POST() {
  // Safety: don't allow DB nukes in production
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Reset disabled in production" }, { status: 403 });
  }

  // Order matters (recipes reference elements)
  await prisma.recipe.deleteMany({});
  await prisma.element.deleteMany({});

  // Re-seed starter elements (normalized)
  const seeded = await Promise.all(
    STARTERS.map((n) => prisma.element.create({ data: { name: normalizeName(n) } })),
  );

  return Response.json({ ok: true, elements: seeded }, { status: 200 });
}
