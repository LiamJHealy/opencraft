import OpenAI from "openai";
import { normalizeName } from "@/lib/normalize";
import type { CombineInput, CombineOutput, CombineProvider } from "./types";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Your prompt (unchanged except we expect emoji & complexity in output) */
export const SYSTEM_PROMPT =
  "You are a word-combining engine for a creative game.\n" +
  "Your job is to take two input words from the user and return one new word or short phrase that feels logically or culturally connected to them. The output must be fun, surprising, and playable in a word-combination game.\n" +
  "Rules:\n" +
  "1. Output only one word or short phrase:\n" +
  " - Never return sentences, lists, or explanations.\n" +
  " - Keep the response concise to one word preferable for nouns and 2 words if Proper Noun.\n" +
  "2. Complexity levels (1–5):\n" +
  " - Level 1: Very simple, general, elemental (e.g., fire, rain, dirt, wind).\n" +
  " - Level 2: Natural phenomena / direct consequences (e.g., storm, lava, smoke).\n" +
  " - Level 3: Stronger forces / specific events (e.g., eruption, explosion, blizzard).\n" +
  " - Level 4: Dramatic or abstract concepts (e.g., inferno, tempest, cataclysm).\n" +
  " - Level 5: Advanced, cultural, or metaphorical (e.g., USA, Donald Trump, Bitcoin, Phenomenon).\n" +
  "3. When combining:\n" +
  " - Estimate the complexity level of the two input words.\n" +
  " - The output should be similar to or 1 step higher in complexity than the inputs.\n" +
  " - If both inputs are natural/simple (L1–L2) → return a natural phenomenon (storm, lava).\n" +
  " - If inputs are social/political/economic/cultural → allow cultural entities, people, or institutions (USA, Donald Trump, Bitcoin).\n" +
  " - If one input is natural and the other cultural → you may bridge them metaphorically (fire + law → revolution).\n" +
  "4. Creativity balance:\n" +
  " - The result should feel connected to the inputs but not too obvious.\n" +
  " - Surprising answers are good, but they must still make sense with both inputs.\n" +
  " - Leverage current affairs and recency where possible and don't be afraid to return Proper Nouns.\n" +
  "5. Style:\n" +
  " - Keep the outputs short, punchy, and game-friendly.\n" +
  " - Use proper casing for names and acronyms (e.g., USA, Zeus, Donald Trump).\n" +
  "6) If inputs differ in complexity, slightly bias the RESULT toward the MORE COMPLEX input (at most +1 vs the higher input).\n" +
  "Example Behavior:\n" +
  "- rain + energy → Storm\n" +
  "- earth + fire → Lava\n" +
  "- volcano + thunder → Inferno\n" +
  "- tariff + law → USA\n" +
  "- money + technology → Bitcoin\n" +
  "- star + movie → Hollywood";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    result:     { type: "string",  minLength: 1, maxLength: 40 },
    complexity: { type: "integer", minimum: 1,  maximum: 5  },
    emoji:      { type: "string",  minLength: 1, maxLength: 10 },
    reasoning:  { type: "string",  maxLength: 120 }
  },
  required: ["result", "complexity", "emoji", "reasoning"]
} as const;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function isRetryable(err: any) {
  const s = err?.status ?? err?.response?.status;
  return s === 429 || (typeof s === "number" && s >= 500);
}

/** Loose check that looks like a single emoji sequence (accepts ZWJ/VS-16) */
function sanitizeEmoji(s: any): string | null {
  if (typeof s !== "string") return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  // Reject letters/digits/commas etc. (we want glyphs only)
  if (/[A-Za-z0-9]/.test(trimmed)) return null;
  // Keep it short; most emoji sequences are < 10 code units
  if (trimmed.length > 10) return null;
  // A simple pictographic presence check (modern Node supports this)
  if (!/\p{Extended_Pictographic}/u.test(trimmed)) return null;
  return trimmed;
}

async function callWithSchema(l: string, r: string) {
  return client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: `L: ${l}\nR: ${r}\nReturn JSON only.` }
    ],
    temperature: 0.25,
    max_tokens: 500,
    response_format: {
      type: "json_schema",
      json_schema: { name: "CombineResult", schema: SCHEMA, strict: true }
    }
  });
}

async function callPlainJSON(l: string, r: string) {
  const prompt = `L: ${l}\nR: ${r}\nReturn ONLY JSON: {"result":"<1–2 words>","complexity":<1-5>,"emoji":"<single emoji>","reasoning":"<short>"}`;
  return client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: prompt }
    ],
    temperature: 0.25,
    max_tokens: 80
  });
}

export class OpenAIProvider implements CombineProvider {
  readonly name = "openai" as const;

  async combine({ left, right }: CombineInput): Promise<CombineOutput> {
    const l = normalizeName(left);
    const r = normalizeName(right);

    let lastErr: any;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const completion = attempt === 0 ? await callWithSchema(l, r) : await callPlainJSON(l, r);
        const text = completion.choices?.[0]?.message?.content ?? "";
        const obj = JSON.parse(text);

        const result = normalizeName(String(obj.result || "")) || normalizeName(`${l} ${r}`);
        let complexity = Number(obj.complexity);
        if (!Number.isFinite(complexity)) complexity = 3;
        if (complexity < 1) complexity = 1;
        if (complexity > 5) complexity = 5;

        const provEmoji = sanitizeEmoji(obj.emoji);
        const reasoning = obj.reasoning ? `openai:${String(obj.reasoning)}` : "openai";

        return { result, complexity, emoji: provEmoji || undefined, reasoning, provider: "openai" };
      } catch (err: any) {
        lastErr = err;
        if (isRetryable(err)) { await sleep(300 * (attempt + 1)); continue; }
        if (attempt === 0) { continue; } // retry once with plain JSON
      }
    }

    // Hard fallback so the game never blocks
    return {
      result: normalizeName(`${normalizeName(left)} ${normalizeName(right)}`) || "fusion",
      complexity: 3,
      emoji: undefined,
      reasoning: "openai:hard-fallback",
      provider: "openai",
    };
  }
}
