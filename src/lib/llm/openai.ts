// src/lib/llm/openai.ts

import OpenAI from "openai";
import { normalizeName } from "@/lib/normalize";
import type { CombineInput, CombineOutput, CombineProvider } from "./types";
import { pickSeedExamples, buildAvoidList } from "@/lib/seeds";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Lean rules + mention of seed_examples/avoid.
 * Output must be strict JSON conforming to SCHEMA.
 */
export const SYSTEM_PROMPT =
  "You are a word-combining engine for a creative game.\n" +
  "Given two input words, return ONE new English word/name that makes logical, natural, or cultural sense with BOTH inputs.\n" +
  "\nRules:\n" +
  "- Output ONLY strict JSON: {\"result\": string, \"emoji\": string}.\n" +
  "- Return exactly one short word/name (no sentences, no lists, no concatenations of inputs, no profanity).\n" +
  "- Cultural entities (USA, Zeus, Bitcoin) are allowed when appropriate. Use proper casing.\n" +
  "- Use common English words and avoid anything too abstract. It should be simple for anyone to understand.\n"
  "- Use the provided seed_examples as style guidance and NEVER output any word listed in 'avoid'.\n";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    result: { type: "string", minLength: 1, maxLength: 40 },
    emoji:  { type: "string", minLength: 1, maxLength: 10 }
  },
  required: ["result", "emoji"]
} as const;

/** Loose check that looks like a single emoji sequence (accepts ZWJ/VS-16) */
function sanitizeEmoji(s: unknown): string | undefined {
  if (typeof s !== "string") return undefined;
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  if (/[A-Za-z0-9]/.test(trimmed)) return undefined;
  if (trimmed.length > 10) return undefined;
  return /\p{Extended_Pictographic}/u.test(trimmed) ? trimmed : undefined;
}

/**
 * Single entry point to the model using Structured Outputs (JSON Schema).
 * The `payload` should include inputs, seed_examples, avoid, constraints, etc.
 */
async function callWithSchema(payload: unknown) {
  return client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: JSON.stringify(payload) }
    ],
    temperature: 0.8,
    max_tokens: 160,
    response_format: {
      type: "json_schema",
      json_schema: { name: "CombineResult", schema: SCHEMA, strict: true }
    }
  });
}

export class OpenAIProvider implements CombineProvider {
  readonly name = "openai" as const;

  async combine({ left, right }: CombineInput): Promise<CombineOutput> {
    // Normalize inputs
    const l = normalizeName(left);
    const r = normalizeName(right);

    try {
      // Build dynamic few-shots and an avoid list from seeds + DB
      const seed_examples = pickSeedExamples(l, r, 3);
      const avoid = await buildAvoidList(l, r);

      // Construct a single user payload and call the model
      const payload = {
        inputs: { left: l, right: r },
        seed_examples,
        avoid,
        constraints: { maxResultLen: 40 }
      };

      const completion = await callWithSchema(payload);
      const text = completion.choices?.[0]?.message?.content ?? "";
      const obj: any = JSON.parse(text);

      const result = normalizeName(String(obj.result ?? "")).slice(0, 40);
      const emoji  = sanitizeEmoji(obj.emoji);

      if (!result || !emoji) {
        // Treat as failure so the route returns 502
        return { result: "" };
      }

      return { result, emoji, provider: "openai" };
    } catch {
      // On any failure, return an unusable result to trigger 502 in the route
      return { result: "" };
    }
  }
}

export function getProvider(): CombineProvider {
  return new OpenAIProvider();
}
