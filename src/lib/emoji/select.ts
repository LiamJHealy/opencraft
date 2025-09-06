// server-only helper: candidate mining + LLM pick
import { prisma } from "@/lib/prisma";

// Dynamically import to avoid bundling big JSON into client
async function loadEmojiData() {
  // Emojibase “en” dataset items typically have: emoji, label, tags, group, version, etc.
  const data: any[] = (await import("emojibase-data/en/data.json")).default as any[];
  return data;
}

type Candidate = { emoji: string; label: string; tags: string[]; score: number };

// quick filters to keep results sane
function isFlag(s: string) {
  // two Regional Indicator Symbols = country flags
  return /\p{Regional_Indicator}\p{Regional_Indicator}/u.test(s);
}
function hasTone(s: string) {
  // variation selectors or skin tones can be OK, but we generally prefer base emoji for elements
  return /\p{Emoji_Modifier}|️/u.test(s);
}

function tokenize(s: string) {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

export async function findEmojiCandidates(term: string, max = 8): Promise<Candidate[]> {
  const data = await loadEmojiData();
  const qTokens = new Set(tokenize(term));

  const scored: Candidate[] = [];

  for (const row of data) {
    const char = row.emoji as string | undefined;
    if (!char) continue;
    if (isFlag(char)) continue;

    const label = String(row.label || "");
    const tags: string[] = Array.isArray(row.tags) ? row.tags : [];
    const allText = [label, ...tags].join(" ").toLowerCase();

    // simple scoring: exact token hits weighted higher than substring
    let score = 0;
    for (const t of qTokens) {
      if (label.toLowerCase() === t) score += 5;
      if (label.toLowerCase().includes(t)) score += 3;
      if (tags.some((kw) => kw.toLowerCase() === t)) score += 3;
      if (allText.includes(t)) score += 1;
    }

    if (score > 0) {
      scored.push({
        emoji: char,
          // prefer base char if there’s a text presentation sequence
        label,
        tags,
        score: score - (hasTone(char) ? 1 : 0),
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, max);
}

// ---- LLM pick (Ollama) ----
async function ollamaPick(term: string, candidates: Candidate[]) {
  const url = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "mistral";

  const list = candidates.map((c, i) => `${i + 1}. ${c.emoji}  "${c.label}" [${c.tags.join(", ")}]`).join("\n");

  const prompt = `You are choosing the single best emoji for a game element.

Term: ${term}

Candidates (pick exactly ONE by emoji char):
${list}

Rules:
- Pick only from the list.
- Prefer a single, generic emoji that matches the concept. Avoid flags and skin tones.
- Output strict JSON on one line: {"emoji":"<emoji>","why":"<short reason>"} with no extra text.`;

  const res = await fetch(`${url}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0, stop: ["\n"] },
    }),
  });

  if (!res.ok) throw new Error(`ollama error ${res.status}`);
  const data = await res.json().catch(() => ({}));
  let raw = String(data.response ?? "").trim();
  try {
    const parsed = JSON.parse(raw);
    const chosen = String(parsed.emoji || "");
    // ensure it’s among the candidates
    if (candidates.some((c) => c.emoji === chosen)) return { emoji: chosen, why: String(parsed.why || "") };
  } catch {}
  // fallback: first candidate
  return { emoji: candidates[0]?.emoji ?? "🧩", why: "fallback" };
}

export async function ensureElementEmoji(name: string): Promise<string> {
  const n = name.trim().toLowerCase();
  const el = await prisma.element.findUnique({ where: { name: n } });
  if (!el) throw new Error(`Element not found: ${n}`);
  if (el.emoji) return el.emoji;

  // 1) find candidates locally
  const candidates = await findEmojiCandidates(n, 8);
  let chosen = candidates[0]?.emoji ?? null;

  // 2) ask LLM to choose the best among them (if we have >1)
  if (candidates.length > 1) {
    const pick = await ollamaPick(n, candidates);
    chosen = pick.emoji || chosen;
  }

  const emoji = chosen || "🧩";
  await prisma.element.update({
    where: { id: el.id },
    data: { emoji },
  });

  return emoji;
}
