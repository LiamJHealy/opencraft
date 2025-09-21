import { CombineInput, CombineOutput, CombineProvider } from "./types";
import { normalizeName } from "@/lib/normalize";

function buildPrompt(left: string, right: string) {
  // Keep this tight/deterministic so models return a single short answer.
  return `You are an alchemy crafting assistant. Combine two base words into a single, concise result used in a crafting game.

Rules:
- Output ONLY the result word or very short phrase (max 2 words). No punctuation, no explanations.
- Be consistent with common crafting logic (e.g., fire + water -> steam).
- If you truly cannot infer a sensible result, output: Unknown

Inputs:
left: ${left}
right: ${right}

Result:`;
}

async function ollamaGenerate(url: string, model: string, prompt: string, signal?: AbortSignal) {
  const res = await fetch(`${url}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.2,
        top_p: 0.9,
        repeat_penalty: 1.1,
        stop: ["\n"], // stop at first newline
      },
    }),
    signal,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`ollama error ${res.status}: ${txt}`);
  }
  const data = await res.json();
  // Ollama /api/generate returns { response: "..." }
  return String(data.response ?? "");
}

function postProcess(raw: string) {
  // Trim, strip quotes/backticks, keep only first line and 2 words max
  let out = raw.trim().replace(/^["'`]|["'`]$/g, "");
  out = out.split("\n")[0].trim();
  // reduce to max 2 words
  const parts = out.split(/\s+/).slice(0, 2);
  out = parts.join(" ");
  // common "Unknown" guard
  if (/^unknown$/i.test(out) || out.length === 0) return null;
  return normalizeName(out);
}

export class OllamaProvider implements CombineProvider {
  constructor(private url = process.env.OLLAMA_URL!, private model = process.env.OLLAMA_MODEL!) {}
  async combine({ left, right }: CombineInput): Promise<CombineOutput> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15_000); // 15s timeout
    try {
      const prompt = buildPrompt(left, right);
      const raw = await ollamaGenerate(this.url, this.model, prompt, controller.signal);
      const parsed = postProcess(raw);
      const result = parsed ?? normalizeName(`${left} ${right}`); // fallback
      return { result, provider: "ollama" };
    } finally {
      clearTimeout(t);
    }
  }
}
