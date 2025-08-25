import { prisma } from "./prisma";
import { normalizeName } from "./normalize";

export async function getOrCreateElement(raw: string) {
  const name = normalizeName(raw);
  return prisma.element.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

export async function findExistingRecipe(leftRaw: string, rightRaw: string) {
  const leftName = normalizeName(leftRaw);
  const rightName = normalizeName(rightRaw);

  const [left, right] = await Promise.all([
    prisma.element.findUnique({ where: { name: leftName } }),
    prisma.element.findUnique({ where: { name: rightName } }),
  ]);
  if (!left || !right) return null;

  return prisma.recipe.findFirst({
    where: {
      OR: [
        { leftId: left.id,  rightId: right.id },
        { leftId: right.id, rightId: left.id },
      ],
    },
    include: {
      left: true,
      right: true,
      result: true,
    },
  });
}
