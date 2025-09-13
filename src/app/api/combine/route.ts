// src/app/api/combine/route.ts

import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";
import { getOrCreateElement, findExistingRecipe } from "@/lib/db";
import { getProvider } from "@/lib/llm";
import { toDisplayName } from "@/lib/text";
import { findSeed } from "@/lib/seeds";
import type { $Enums } from "@prisma/client";


function toSource(providerName?: string): $Enums.RecipeSource {
  const p = (providerName || "").toLowerCase();
  if (p === "canon")  return "CANON";
  if (p === "ollama") return "OLLAMA";
  if (p === "openai") return "OPENAI";
  if (p === "mock")   return "MOCK";
  return "MANUAL";
}

// very light server-side emoji sanity
function isEmojiLike(s: any): s is string {
  if (typeof s !== "string") return false;
  const t = s.trim();
  if (!t) return false;
  if (/[A-Za-z0-9]/.test(t)) return false;
  if (t.length > 10) return false;
  return /\p{Extended_Pictographic}/u.test(t);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as any));

    const leftRaw  = typeof body?.left  === "string" ? body.left  : "";
    const rightRaw = typeof body?.right === "string" ? body.right : "";

    const leftName  = normalizeName(leftRaw);
    const rightName = normalizeName(rightRaw);

    if (!leftName || !rightName) {
      return Response.json({ error: "left and right are required strings" }, { status: 400 });
    }

    // 1) Known? ensure emoji exists, return immediately
    const existing = await findExistingRecipe(leftName, rightName);
    if (existing) {
      try {
        const { ensureElementEmoji } = await import("@/lib/emoji/select");
        await ensureElementEmoji(existing.result.name);
      } catch {}
      const el = await prisma.element.findUnique({
        where: { id: existing.resultId },
        select: { emoji: true },
      });

      return Response.json(
        {
          status: "known",
          left: toDisplayName(existing.left.name),
          right: toDisplayName(existing.right.name),
          result: toDisplayName(existing.result.name),
          recipeId: existing.id,
          provider: "db",
          resultEmoji: el?.emoji ?? null,
        },
        { status: 200 }
      );
    }

    // 1.5) Seeded (JSON) pair? create recipe from seeds and return
const seeded = findSeed(leftName, rightName);
if (seeded) {
  const [leftEl, rightEl, resultEl] = await Promise.all([
    getOrCreateElement(leftName),
    getOrCreateElement(rightName),
    getOrCreateElement(seeded.result),
  ]);

  const rec = await prisma.recipe.create({
    data: {
      leftId: leftEl.id,
      rightId: rightEl.id,
      resultId: resultEl.id,
      source: "CANON", // curated seeds
    },
  });

  // Persist emoji if provided by seeds and not already set
  let finalEmoji: string | null = null;
  try {
    const current = await prisma.element.findUnique({
      where: { id: resultEl.id },
      select: { emoji: true },
    });

    if (!current?.emoji && seeded.emoji) {
      await prisma.element.update({
        where: { id: resultEl.id },
        data: { emoji: seeded.emoji.trim() },
      });
      finalEmoji = seeded.emoji.trim();
    } else {
      const { ensureElementEmoji } = await import("@/lib/emoji/select");
      finalEmoji = await ensureElementEmoji(resultEl.name);
    }
  } catch {
    // ignore emoji errors
  }

  return Response.json(
    {
      status: "seeded",
      left: toDisplayName(leftEl.name),
      right: toDisplayName(rightEl.name),
      result: toDisplayName(resultEl.name),
      recipeId: rec.id,
      provider: "seed",
      resultEmoji: finalEmoji,
    },
    { status: 201 }
  );
}

    // 2) Ask active provider — now returns ONLY { result, emoji }
    const provider = getProvider();
    const providerName = provider.name ?? "openai";

    const { result, emoji: providerEmoji } = await provider.combine({
      left: leftName,
      right: rightName,
    });

    if (!result) {
      return Response.json({ error: "provider returned empty result" }, { status: 502 });
    }
    if (result.length > 40) {
      return Response.json({ error: "result too long" }, { status: 400 });
    }

    // 3) Upsert elements + create recipe
    const [leftEl, rightEl, resultEl] = await Promise.all([
      getOrCreateElement(leftName),
      getOrCreateElement(rightName),
      getOrCreateElement(result),
    ]);

    const rec = await prisma.recipe.create({
      data: {
        leftId: leftEl.id,
        rightId: rightEl.id,
        resultId: resultEl.id,
        source: toSource(providerName), 
      },
    });

    // 4) Persist emoji (if none set yet on the element)
    let finalEmoji: string | null = null;
    try {
      const current = await prisma.element.findUnique({
        where: { id: resultEl.id },
        select: { emoji: true },
      });

      if (!current?.emoji && isEmojiLike(providerEmoji)) {
        const trimmed = providerEmoji!.trim();
        await prisma.element.update({
          where: { id: resultEl.id },
          data: { emoji: trimmed },
        });
        finalEmoji = trimmed;
      } else {
        const { ensureElementEmoji } = await import("@/lib/emoji/select");
        finalEmoji = await ensureElementEmoji(resultEl.name);
      }
    } catch {
      // ignore emoji errors; we return null
    }

    return Response.json(
      {
        status: "created",
        left: toDisplayName(leftEl.name),
        right: toDisplayName(rightEl.name),
        result: toDisplayName(resultEl.name),
        recipeId: rec.id,
        provider: providerName,
        resultEmoji: finalEmoji,
      },
      { status: 201 }
    );
  } catch (e: any) {
    return Response.json({ error: e?.message || "combine failed" }, { status: 500 });
  }
}
