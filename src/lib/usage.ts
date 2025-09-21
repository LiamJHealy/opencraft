// src/lib/usage.ts
import { prisma } from "@/lib/prisma";
import { OVERUSE_RECENT_WINDOW_H } from "@/lib/config/quality";

export type UsageStats = { total: number; recent: number };

export async function getUsageStatsBatch(names: string[]): Promise<Record<string, UsageStats>> {
  const uniq = Array.from(new Set(names.map((n) => n.toLowerCase())));
  if (!uniq.length) return {};

  const words = await prisma.word.findMany({
    where: { name: { in: uniq } },
    select: { id: true, name: true },
  });
  const idByName = new Map(words.map((word) => [word.name.toLowerCase(), word.id]));
  const ids = words.map((word) => word.id);
  if (!ids.length) {
    return Object.fromEntries(uniq.map((n) => [n, { total: 0, recent: 0 }]));
  }

  const totals = await prisma.recipeEdge.groupBy({
    by: ["resultId"],
    where: { resultId: { in: ids } },
    _count: { _all: true },
  });

  const since = new Date(Date.now() - OVERUSE_RECENT_WINDOW_H * 3600 * 1000);
  const recents = await prisma.recipeEdge.groupBy({
    by: ["resultId"],
    where: { resultId: { in: ids }, createdAt: { gte: since } },
    _count: { _all: true },
  });

  const totalById = new Map<number, number>();
  for (const entry of totals) totalById.set(entry.resultId as number, entry._count._all);

  const recentById = new Map<number, number>();
  for (const entry of recents) recentById.set(entry.resultId as number, entry._count._all);

  const out: Record<string, UsageStats> = {};
  for (const name of uniq) {
    const id = idByName.get(name);
    const total = id ? totalById.get(id) ?? 0 : 0;
    const recent = id ? recentById.get(id) ?? 0 : 0;
    out[name] = { total, recent };
  }
  return out;
}
