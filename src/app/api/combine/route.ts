import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";
import { getOrCreateElement, findExistingRecipe } from "@/lib/db";
import { getProvider } from "@/lib/llm";
import { toDisplayName } from "@/lib/text";
import type { $Enums } from "@prisma/client";

/** Map provider name to Prisma enum value */
function toSource(providerName?: string): $Enums.RecipeSource {
  const p = (providerName || "").toLowerCase();
  if (p === "canon") return "CANON";
  if (p === "ollama") return "OLLAMA";
  if (p === "mock") return "MOCK";
  return "MANUAL";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as any));

    const leftRaw  = typeof body?.left  === "string" ? body.left  : "";
    const rightRaw = typeof body?.right === "string" ? body.right : "";

    const leftName  = normalizeName(leftRaw);
    const rightName = normalizeName(rightRaw);

    if (!leftName || !rightName) {
      return Response.json(
        { error: "left and right are required strings" },
        { status: 400 }
      );
    }

    // 1) Return archived result if it already exists (DB cache)
    const existing = await findExistingRecipe(leftName, rightName);
    if (existing) {
      return Response.json(
        {
          status: "known",
          left: toDisplayName(existing.left.name),
          right: toDisplayName(existing.right.name),
          result: toDisplayName(existing.result.name),
          recipeId: existing.id,
          provider: "db",
          reasoning: "archive",
        },
        { status: 200 }
      );
    }

    // 2) Call the active provider (wrapped with canon+aliases via getProvider)
    const provider = getProvider();
    const { result, reasoning, provider: providerName } = await provider.combine({
      left: leftName,
      right: rightName,
    });

    if (!result) {
      return Response.json(
        { error: "provider returned empty result" },
        { status: 502 }
      );
    }

    // basic guardrails
    if (result.length > 40) {
      return Response.json({ error: "result too long" }, { status: 400 });
    }

    // 3) Upsert elements + create recipe row (NOW with source + reasoning)
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
        source: toSource(providerName),           // ← save provenance
        reasoning: reasoning ?? null,             // ← save provider reasoning (optional)
      },
    });

    return Response.json(
      {
        status: "created",
        left: toDisplayName(leftEl.name),
        right: toDisplayName(rightEl.name),
        result: toDisplayName(resultEl.name),
        recipeId: rec.id,
        provider: providerName, // "canon" | "ollama" | "mock"
        reasoning,              // e.g., "canon", "ollama", "ollama:fallback"
      },
      { status: 201 }
    );
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "combine failed" },
      { status: 500 }
    );
  }
}
