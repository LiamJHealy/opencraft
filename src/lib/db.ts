import { prisma } from "./prisma";
import { normalizeName } from "./normalize";

type WordOptions = {
  emoji?: string | null;
  category?: string | null;
  tier?: number | null;
  isStarter?: boolean;
  isGoal?: boolean;
};

export async function getOrCreateWord(raw: string, options: WordOptions = {}) {
  const name = normalizeName(raw);
  if (!name) throw new Error("Cannot create a word without a name");

  const updateData: Record<string, unknown> = {};
  if (options.emoji !== undefined) updateData.emoji = options.emoji ?? null;
  if (options.category !== undefined) updateData.category = options.category ?? null;
  if (options.tier !== undefined) updateData.tier = options.tier;
  if (options.isStarter !== undefined) updateData.isStarter = options.isStarter;
  if (options.isGoal !== undefined) updateData.isGoal = options.isGoal;

  return prisma.word.upsert({
    where: { name },
    update: updateData,
    create: {
      name,
      emoji: options.emoji ?? null,
      category: options.category ?? null,
      tier: options.tier ?? null,
      isStarter: options.isStarter ?? false,
      isGoal: options.isGoal ?? false,
    },
  });
}

export const getOrCreateElement = getOrCreateWord;

type LookupOptions = {
  includeResult?: boolean;
};

export async function findExistingEdge(leftRaw: string, rightRaw: string, resultRaw?: string, options: LookupOptions = {}) {
  const leftName = normalizeName(leftRaw);
  const rightName = normalizeName(rightRaw);
  const resultName = resultRaw ? normalizeName(resultRaw) : undefined;

  const [left, right, result] = await Promise.all([
    prisma.word.findUnique({ where: { name: leftName } }),
    prisma.word.findUnique({ where: { name: rightName } }),
    resultName ? prisma.word.findUnique({ where: { name: resultName } }) : Promise.resolve(null),
  ]);

  if (!left || !right) return null;

  return prisma.recipeEdge.findFirst({
    where: {
      OR: [
        {
          leftId: left.id,
          rightId: right.id,
          resultId: result?.id,
        },
        {
          leftId: right.id,
          rightId: left.id,
          resultId: result?.id,
        },
      ],
    },
    include: {
      left: true,
      right: true,
      result: options.includeResult ?? true,
    },
  });
}

export function findExistingRecipe(leftRaw: string, rightRaw: string, resultRaw?: string, options: LookupOptions = {}) {
  return findExistingEdge(leftRaw, rightRaw, resultRaw, options);
}
 
