// src/lib/llm/index.ts
import type { CombineProvider } from "./types";
import { MockProvider } from "./mock";
import { OllamaProvider } from "./ollama";
import { CanonicalWrapper } from "./canonical"; // <-- make sure this file exists

export function getProvider(): CombineProvider {
  const who = (process.env.MODEL_PROVIDER ?? "mock").toLowerCase();

  const base: CombineProvider =
    who === "ollama" ? new OllamaProvider() : new MockProvider();

  // Always wrap with canon+aliases so core results are guaranteed
  return new CanonicalWrapper(base);
}
