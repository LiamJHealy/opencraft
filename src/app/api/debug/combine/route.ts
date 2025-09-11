// src/app/api/debug/combine/route.ts
import { normalizeName } from "@/lib/normalize";
import {
  __debug_callMany,
  __debug_resultAlreadyUsedInDB,
  __debug_countResultUsage,
  __debug_estimateInputComplexity,
  type __DebugCand,
} from "@/lib/llm/openai";

type ScoredCand = __DebugCand & {
  usedInDB: boolean;
  usageCount?: number;   // only set when all are used
  score: number;
};

function clampComplexity(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 3;
  return Math.max(1, Math.min(5, Math.round(x)));
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const leftIn: string = body?.left ?? "";
    const rightIn: string = body?.right ?? "";
    const left = normalizeName(leftIn);
    const right = normalizeName(rightIn);

    if (!left || !right) {
      return Response.json({ error: "left and right are required strings" }, { status: 400 });
    }

    // 1) Ask the LLM for up to 10 candidates
    const raw = await __debug_callMany(left, right, 10);

    const rawCount = raw.length; // number parsed by callMany (already JSON-parsed choices)
    const parsedCountBeforeDedupe = rawCount;

    // 2) Dedupe names and drop any equal to inputs
    const seen = new Set<string>();
    const unique: __DebugCand[] = [];
    for (const c of raw) {
      const name = normalizeName(c.result);
      if (!name || name === left || name === right) continue;
      if (seen.has(name)) continue;
      seen.add(name);
      unique.push({ ...c, result: name, complexity: clampComplexity(c.complexity) });
    }

    const parsedCountAfterDedupe = unique.length;

    // If nothing parsed, just return raw for inspection
    if (unique.length === 0) {
      return Response.json({
        left, right,
        inputComplexity: {
          left: __debug_estimateInputComplexity(left),
          right: __debug_estimateInputComplexity(right),
        },
        candidates: [],
        chosen: null,
        note: "No usable candidates parsed",
      }, { status: 200 });
    }

    // 3) Compute target complexity (slight bias to the more complex input)
    const lc = __debug_estimateInputComplexity(left);
    const rc = __debug_estimateInputComplexity(right);
    const higher = Math.max(lc, rc);
    const diff = Math.abs(lc - rc);
    const target = Math.min(5, higher + (diff >= 2 ? 1 : diff >= 1 ? 0.5 : 0));

    // 4) Mark which are already used in DB and compute scores
    const usedFlags = await Promise.all(unique.map(c => __debug_resultAlreadyUsedInDB(c.result)));
    const scored: ScoredCand[] = unique.map((c, i) => {
      const comp = clampComplexity(c.complexity);
      const score = Math.abs(comp - target) + (c.result.length * 0.001);
      return { ...c, usedInDB: usedFlags[i], score };
    });

    // 5) Choose like the provider: prefer "fresh" (not used in DB), else least-used
    const fresh = scored.filter(c => !c.usedInDB).sort((a, b) => a.score - b.score);

    let chosen: ScoredCand | null = null;
    let strategy: "fresh-by-score" | "least-used-by-score" | "none" = "none";

    if (fresh.length > 0) {
      chosen = fresh[0];
      strategy = "fresh-by-score";
    } else {
      // All used → fetch counts and pick the least common, then by score.
      const counts = await Promise.all(scored.map(c => __debug_countResultUsage(c.result)));
      const withCounts = scored.map((c, i) => ({ ...c, usageCount: counts[i] }));
      withCounts.sort((a, b) => (a.usageCount! - b.usageCount!) || (a.score - b.score));
      chosen = withCounts[0] ?? null;
      strategy = "least-used-by-score";
      // copy back usageCount into scored for transparency
      for (let i = 0; i < scored.length; i++) scored[i].usageCount = withCounts[i].usageCount;
    }

    return Response.json({
        left, right,
        inputComplexity: { left: lc, right: rc, target },
        rawCount,
        parsedCountBeforeDedupe,
        parsedCountAfterDedupe,
        candidates: scored,
        chosen,
        strategy,
    }, { status: 200 });

  } catch (err: any) {
    return Response.json({ error: err?.message || "debug combine failed" }, { status: 500 });
  }
}

// Optional: a simple GET help message
export async function GET() {
  return Response.json({
    usage: "POST { left: string, right: string } to this endpoint to see candidates, DB-dup flags, scores, and the chosen one."
  });
}
