import { CombineProvider } from "./types";
import { MockProvider } from "./mock";
import { OllamaProvider } from "./ollama";

export function getProvider(): CombineProvider {
  const p = (process.env.MODEL_PROVIDER || "mock").toLowerCase();
  if (p === "ollama") return new OllamaProvider();
  return new MockProvider(); // default
}
