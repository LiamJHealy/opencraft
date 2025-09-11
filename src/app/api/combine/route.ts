import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";
import { getOrCreateElement, findExistingRecipe } from "@/lib/db";
import { getProvider } from "@/lib/llm";
import { toDisplayName } from "@/lib/text";
import type { $Enums } from "@prisma/client";

function toSource(providerName?: string): $Enums.RecipeSource {
  const p = (providerName || "").toLowerCase();
  if (p === "canon")  return "CANON";
  if (p === "ollama") return "OLLAMA";
  if (p === "openai") return "OPENAI";
  if (p === "mock")   return "MOCK";
  return "MANUAL";
}

// very light server-side emoji sanity (same as provider’s sanitize)
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
      const el = await prisma.element.findUnique({ where: { id: existing.resultId }, select: { emoji: true } });
      return Response.json(
        {
          status: "known",
          left: toDisplayName(existing.left.name),
          right: toDisplayName(existing.right.name),
          result: toDisplayName(existing.result.name),
          recipeId: existing.id,
          provider: "db",
          reasoning: "archive",
          complexity: existing.complexity ?? null,
          resultEmoji: el?.emoji ?? null,
        },
        { status: 200 }
      );
    }

    // 2) Ask active provider (canon wrapper around it)
    const provider = getProvider();
    const { result, reasoning, provider: providerName, complexity, emoji: providerEmoji } = await provider.combine({
      left: leftName,
      right: rightName,
    });

    if (!result) return Response.json({ error: "provider returned empty result" }, { status: 502 });
    if (result.length > 40) return Response.json({ error: "result too long" }, { status: 400 });

    // 3) Upsert elements + create recipe (save provenance + complexity)
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
        reasoning: reasoning ?? null,
        complexity:
          typeof complexity === "number" ? Math.max(1, Math.min(5, Math.floor(complexity))) : null,
      },
    });

    // 4) Persist emoji:
    //    - if provider suggested a valid emoji and element has none → save it
    //    - otherwise compute/ensure one (Emojibase + LLM rerank) via ensureElementEmoji
    let finalEmoji: string | null = null;
    try {
      const current = await prisma.element.findUnique({ where: { id: resultEl.id }, select: { emoji: true } });
      if (!current?.emoji && isEmojiLike(providerEmoji)) {
        await prisma.element.update({ where: { id: resultEl.id }, data: { emoji: providerEmoji!.trim() } });
        finalEmoji = providerEmoji!.trim();
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
        reasoning,
        complexity: rec.complexity ?? complexity ?? null,
        resultEmoji: finalEmoji,
      },
      { status: 201 }
    );
  } catch (e: any) {
    return Response.json({ error: e?.message || "combine failed" }, { status: 500 });
  }
}
