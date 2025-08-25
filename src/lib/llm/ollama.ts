import { CombineInput, CombineOutput, CombineProvider } from "./types";
import { normalizeName } from "@/lib/normalize";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "mistral";

const PROMPT = (left: string, right: string) => `
You are a creative but succinct "element combiner". Combine two concepts into a single short result.
Rules:
- Return ONLY the result word or very short phrase (no punctuation, no quotes, no extra text).
- Keep it SFW and neutral.
- Prefer noun-like results.
Left: "${left}"
Right: "${right}"
Result:
`.trim();

export class OllamaProvider implements CombineProvider {
  async combine({ left, right }: CombineInput): Promise<CombineOutput> {
    const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: PROMPT(left, right),
        stream: false,
        options: {
          temperature: 0.2,
          top_p: 0.9,
          repeat_penalty: 1.1,
        },
      }),
      // Optional timeout
      signal: AbortSignal.timeout?.(20_000),
    });

    if (!resp.ok) {
      throw new Error(`Ollama error: ${resp.status} ${resp.statusText}`);
    }

    const data = await resp.json(); // { response: "..." }
    let out = String(data?.response ?? "").trim();
    // Basic cleanup: remove wrapping quotes/periods
    out = out.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").replace(/[.!?]+$/g, "");
    if (!out) throw new Error("Ollama returned empty result");

    return { result: normalizeName(out), provider: "ollama" };
  }
}
