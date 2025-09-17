// src/lib/llm/openai.ts
// src/lib/llm/openai.ts

import OpenAI from "openai";
import { normalizeName } from "@/lib/normalize";
import type { CombineInput, CombineOutput, CombineProvider } from "./types";
import { pickSeedExamples, buildAvoidList } from "@/lib/seeds";

import { zipf } from "@/lib/lexicon/zipf";
import { STOPWORDS } from "@/lib/filters/stopwords";
import { CONNECTORS } from "@/lib/lexicon/connectors";

import { getUsageStatsBatch } from "@/lib/usage";
import {
  ZIPF_MIN, OVERUSE_SOFT_START, OVERUSE_HARD_BLOCK,
  OVERUSE_SOFT_WEIGHT, OVERUSE_RECENT_WEIGHT, DEBUG_COMBINE
} from "@/lib/config/quality";
import { dlog, r2 } from "@/lib/log";

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** ---- Prompt & Schema: ask for 10 candidates, noun-only, branchable, strict JSON ---- */
export const SYSTEM_PROMPT =
  "You are a word-combining engine for a creative game.\n" +
  "Given two input words, propose 10 candidate outputs.\n\n" +
  "GLOBAL RULES:\n" +
  "- Each candidate MUST be a common, easy-to-understand ENGLISH NOUN.\n" +
  "- Proper nouns are allowed ONLY if BOTH inputs clearly imply a proper noun (e.g., country+president).\n" +
  "- Output must be ONE short word, or a very common 2-word compound (e.g., 'ice cream'). No phrases/sentences.\n" +
  "- Prefer tangible, broadly combinable concepts (places, objects, animals, foods, tools, roles).\n" +
  "- Avoid rare/poetic/technical terms. Keep it simple and familiar.\n" +
  "- The emoji must clearly represent the noun (no generic symbols like ❓ or 🔤).\n" +
  "- NEVER output any word listed in 'avoid'. Follow the style of 'seed_examples'.\n\n" +
  "OUTPUT: strict JSON matching the provided schema with an array 'results'.";

const CANDIDATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    results: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          result: { type: "string", minLength: 1, maxLength: 40 },
          emoji:  { type: "string", minLength: 1, maxLength: 10 },
          pos:    { type: "string", enum: ["noun","proper_noun","adjective","verb"] }
        },
        required: ["result","emoji","pos"]
      }
    }
  },
  required: ["results"]
} as const;

/** Emoji validator: single pictographic, short, no letters/digits */
function sanitizeEmoji(s: unknown): string | undefined {
  if (typeof s !== "string") return undefined;
  const t = s.trim();
  if (!t || /[A-Za-z0-9]/.test(t) || t.length > 10) return undefined;
  return /\p{Extended_Pictographic}/u.test(t) ? t : undefined;
}

/** Very light word-shape/stopword guard */
function rejectEarly(word: string) {
  const w = word.toLowerCase();
  if (!/^[a-z][a-z\- ]*[a-z]$/.test(w)) return true;        // only letters + optional spaces/hyphens
  if (STOPWORDS.has(w)) return true;                        // function words
  if (w.length <= 2 && !["sun","ice","war","law","sea","dog","cat","map"].includes(w)) return true;
  if (/(ism|ology|ness|tion|ship)$/.test(w)) return true;   // avoid abstract/technical for now
  return false;
}

/** Simple scoring heuristic: frequency + length + connector bonus, with hard filters */
function scoreCandidate(c: { result: string; pos?: string }) {
  const w = c.result.toLowerCase().trim();

  // POS: only nouns
  const pos = (c.pos || "noun").toLowerCase();
  if (!(pos === "noun" || pos === "proper_noun")) return -999;

  // Early rejects
  if (rejectEarly(w)) return -999;

  // Frequency (Zipf) from local JSON map
  const z = zipf(w);               // unknown → 0
  if (z < ZIPF_MIN) return -999;   // drop rare words

  // Length bonus (prefer short/medium nouns)
  const n = w.length;
  let len = 0;
  if (n < 3 || n > 14) len = -2;
  else if (n <= 10) len = 2;
  else len = 1;

  const connector = CONNECTORS.has(w) ? 2 : 0;

  // Base score: weight frequency strongly, then add bonuses
  const score = (z - ZIPF_MIN) * 3 + len + connector;
  return score;
}

/** One model call returning multiple candidates */
async function callWithSchema(payload: unknown) {
  return client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: JSON.stringify(payload) }
    ],
    temperature: 0.65, // slightly lower to reduce obscure/poetic picks
    max_tokens: 220,
    response_format: {
      type: "json_schema",
      json_schema: { name: "CombineCandidates", schema: CANDIDATE_SCHEMA, strict: true }
    }
  });
}

export class OpenAIProvider implements CombineProvider {
  readonly name = "openai" as const;

  async combine({ left, right }: CombineInput): Promise<CombineOutput & { debug?: any }> {
    const l = normalizeName(left);
    const r = normalizeName(right);

    try {
      const seed_examples = pickSeedExamples(l, r, 4);
      const avoid = new Set<string>(await buildAvoidList(l, r));

      const payload = {
        inputs: { left: l, right: r },
        seed_examples,
        avoid: Array.from(avoid),
        constraints: { maxResultLen: 40, requireNoun: true }
      };

      const completion = await callWithSchema(payload);
      const text = completion.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(text) as {
        results: Array<{ result: string; emoji: string; pos?: string }>;
      };

      // Normalize + basic validation
      const candidates = (parsed.results ?? [])
        .map(c => ({
          result: normalizeName(String(c.result || "")).slice(0, 40),
          emoji:  sanitizeEmoji(c.emoji),
          pos:    c.pos
        }))
        .filter(c => c.result && c.emoji && !avoid.has(c.result));

      if (!candidates.length) return { result: "" };

      // Fetch usage counts for duplicate punishment
      const usageMap = await getUsageStatsBatch(candidates.map(c => c.result));

      type Row = {
        word: string; emoji?: string | null; z: number;
        len: number; conn: number; base: number;
        total: number; recent: number; penalty: number; final: number;
      };

      const rows: Row[] = [];
      for (const c of candidates) {
        const w = c.result.toLowerCase();

        // base score (includes POS + early rejects + Zipf threshold + length + connector)
        const base = scoreCandidate({ result: w, pos: c.pos });

        // gather explainables for logging
        const z = zipf(w);
        const n = w.length;
        const len = (n < 3 || n > 14) ? -2 : (n <= 10 ? 2 : 1);
        const conn = CONNECTORS.has(w) ? 2 : 0;

        // usage penalties
        const usage = usageMap[w] ?? { total: 0, recent: 0 };
        let penalty = 0;
        if (usage.total >= OVERUSE_HARD_BLOCK) {
          penalty = 999; // hard block
        } else {
          const softOver = Math.max(0, usage.total - OVERUSE_SOFT_START + 1);
          penalty =
            (softOver > 0 ? Math.log1p(softOver) * OVERUSE_SOFT_WEIGHT : 0) +
            usage.recent * OVERUSE_RECENT_WEIGHT;
        }

        const final = base === -999 ? -999 : (base - penalty);
        rows.push({
          word: w, emoji: c.emoji, z, len, conn, base,
          total: usage.total, recent: usage.recent, penalty, final
        });
      }

      // Sort by final score and pick best above cutoff
      rows.sort((a, b) => b.final - a.final);
      const best = rows.find(r => r.final > -999);
      if (!best) return { result: "" };

      // TERMINAL LOGGING
      if (DEBUG_COMBINE) {
        dlog(`left="${l}" right="${r}"  candidates=${rows.length}`);
        console.table(
          rows.slice(0, 6).map(r => ({
            word: r.word,
            z: r2(r.z),
            len: r.len,
            conn: r.conn,
            base: r2(r.base),
            total: r.total,
            recent: r.recent,
            penalty: r2(r.penalty),
            final: r2(r.final),
            emoji: r.emoji
          }))
        );
        dlog("→ picked:", best.word);
      }

      const bestEmoji =
        candidates.find(c => c.result.toLowerCase() === best.word)?.emoji ?? "✨";

      const out: CombineOutput & { debug?: any } = {
        result: best.word,
        emoji: bestEmoji!,
        provider: "openai",
      };

      if (DEBUG_COMBINE) {
        out.debug = {
          picked: best.word,
          top3: rows.slice(0, 3)
        };
      }

      return out;
    } catch {
      return { result: "" };
    }
  }
}

export function getProvider(): CombineProvider {
  return new OpenAIProvider();
}
