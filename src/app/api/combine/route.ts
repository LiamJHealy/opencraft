// src/app/api/combine/route.ts

import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";
import { getOrCreateElement, findExistingRecipe } from "@/lib/db";
import { getProvider } from "@/lib/llm";
import { toDisplayName } from "@/lib/text";
import { findSeed } from "@/lib/seeds";
import type { $Enums, Prisma } from "@prisma/client";

// --- NEW: optionally treat pairs as commutative ---
const COMMUTATIVE = true;
function canonicalPair(a: string, b: string): [string, string] {
  return COMMUTATIVE && a > b ? [b, a] : [a, b];
}

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

    let leftName  = normalizeName(leftRaw);
    let rightName = normalizeName(rightRaw);

    if (!leftName || !rightName) {
      return Response.json({ error: "left and right are required strings" }, { status: 400 });
    }

    // --- NEW: canonicalize order so water+fire == fire+water ---
    [leftName, rightName] = canonicalPair(leftName, rightName);

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
        { status: 200, headers: { "X-Combine-Source": "db" } }
      );
    }

    // 1.5) Seeded (JSON) pair? create recipe from seeds and return
    // --- CHANGED: check both orders for seeds explicitly, after canonicalization this is mostly redundant but safe ---
    const seeded = findSeed(leftName, rightName) ?? findSeed(rightName, leftName);
    if (seeded) {
      const [leftEl, rightEl, resultEl] = await Promise.all([
        getOrCreateElement(leftName),
        getOrCreateElement(rightName),
        getOrCreateElement(seeded.result),
      ]);

      // --- NEW: race-safe create; if someone else created the same triple, fetch and return it ---
      let rec;
      try {
        rec = await prisma.recipe.create({
          data: {
            leftId: leftEl.id,
            rightId: rightEl.id,
            resultId: resultEl.id,
            source: "CANON",
          },
        });
      } catch (e: any) {
        const code = (e as Prisma.PrismaClientKnownRequestError)?.code;
        if (code === "P2002") {
          // Unique constraint hit; return the existing one
          const again = await findExistingRecipe(leftEl.name, rightEl.name);
          if (again) {
            rec = { id: again.id } as any;
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }

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
          recipeId: rec!.id,
          provider: "seed",
          resultEmoji: finalEmoji,
        },
        { status: 201, headers: { "X-Combine-Source": "seed" } }
      );
    }

    // 2) Ask active provider — now returns ONE best candidate after reranking
    const provider = getProvider();
    const providerName = provider.name ?? "openai";

    // --- NEW: soft retry strategy in case the reranker filters everything ---
    let attempt = await provider.combine({ left: leftName, right: rightName });
    if (!attempt?.result) {
      // One light retry; same inputs, gives the generator a second chance
      attempt = await provider.combine({ left: leftName, right: rightName });
    }
    if (!attempt?.result) {
      // Last-resort: explicit 404-ish signal for the UI to show “try different tiles”
      return Response.json({ error: "no suitable result", hint: "try different words" }, { status: 502 });
    }

    const { result, emoji: providerEmoji } = attempt;

    if (result.length > 40) {
      return Response.json({ error: "result too long" }, { status: 400 });
    }

    // 3) Upsert elements + create recipe
    const [leftEl, rightEl, resultEl] = await Promise.all([
      getOrCreateElement(leftName),
      getOrCreateElement(rightName),
      getOrCreateElement(result),
    ]);

    // --- NEW: race-safe create with Prisma error handling ---
    let rec;
    try {
      rec = await prisma.recipe.create({
        data: {
          leftId: leftEl.id,
          rightId: rightEl.id,
          resultId: resultEl.id,
          source: toSource(providerName),
        },
      });
    } catch (e: any) {
      const code = (e as Prisma.PrismaClientKnownRequestError)?.code;
      if (code === "P2002") {
        const again = await findExistingRecipe(leftEl.name, rightEl.name);
        if (again) {
          rec = { id: again.id } as any;
        } else {
          throw e;
        }
      } else {
        throw e;
      }
    }

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
        recipeId: rec!.id,
        provider: providerName,
        resultEmoji: finalEmoji,
      },
      { status: 201, headers: { "X-Combine-Source": providerName } }
    );
  } catch (e: any) {
    return Response.json({ error: e?.message || "combine failed" }, { status: 500 });
  }
}
