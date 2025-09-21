// server-only helper: candidate mining + LLM pick
import { prisma } from "@/lib/prisma";

async function loadEmojiData() {
  const data: any[] = (await import("emojibase-data/en/data.json")).default as any[];
  return data;
}

type Candidate = { emoji: string; label: string; tags: string[]; score: number };

function isFlag(value: string) {
  return /\p{Regional_Indicator}\p{Regional_Indicator}/u.test(value);
}

function hasTone(value: string) {
  return /\p{Emoji_Modifier}/u.test(value);
}

function tokenize(value: string) {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

export async function findEmojiCandidates(term: string, max = 8): Promise<Candidate[]> {
  const data = await loadEmojiData();
  const queryTokens = new Set(tokenize(term));

  const scored: Candidate[] = [];
  for (const row of data) {
    const char = row.emoji as string | undefined;
    if (!char) continue;
    if (isFlag(char)) continue;

    const label = String(row.label || "");
    const tags: string[] = Array.isArray(row.tags) ? row.tags : [];
    const allText = [label, ...tags].join(" ").toLowerCase();

    let score = 0;
    for (const token of queryTokens) {
      if (label.toLowerCase() === token) score += 5;
      if (label.toLowerCase().includes(token)) score += 3;
      if (tags.some((kw) => kw.toLowerCase() === token)) score += 3;
      if (allText.includes(token)) score += 1;
    }

    if (score > 0) {
      scored.push({
        emoji: char,
        label,
        tags,
        score: score - (hasTone(char) ? 1 : 0),
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, max);
}

async function ollamaPick(term: string, candidates: Candidate[]) {
  const url = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "mistral";

  const list = candidates.map((candidate, index) => `${index + 1}. ${candidate.emoji}  "${candidate.label}" [${candidate.tags.join(", ")}]`).join("\n");

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
    body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0, stop: ["\n"] } }),
  });

  if (!res.ok) throw new Error(`ollama error ${res.status}`);
  const data = await res.json().catch(() => ({}));
  let raw = String(data.response ?? "").trim();

  try {
    const parsed = JSON.parse(raw);
    const chosen = String(parsed.emoji || "");
    if (candidates.some((candidate) => candidate.emoji === chosen)) {
      return { emoji: chosen, why: String(parsed.why || "") };
    }
  } catch {}

  return { emoji: candidates[0]?.emoji ?? "??", why: "fallback" };
}

export async function ensureElementEmoji(name: string): Promise<string> {
  const n = name.trim().toLowerCase();
  const word = await prisma.word.findUnique({ where: { name: n } });
  if (!word) throw new Error(`Element not found: ${n}`);
  if (word.emoji) return word.emoji;

  const candidates = await findEmojiCandidates(n, 8);
  let chosen = candidates[0]?.emoji ?? null;

  if (candidates.length > 1) {
    const pick = await ollamaPick(n, candidates);
    chosen = pick.emoji || chosen;
  }

  const emoji = chosen || "??";
  await prisma.word.update({
    where: { id: word.id },
    data: { emoji },
  });

  return emoji;
}
