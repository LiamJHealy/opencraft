import { CombineProvider } from "./types";
import { MockProvider } from "./mock";
import { OllamaProvider } from "./ollama";
import { OpenAIProvider } from "./openai";

export function getProvider(): CombineProvider {
  const who = process.env.MODEL_PROVIDER?.toLowerCase() ?? "mock";
  if (who === "openai") return new OpenAIProvider();
  if (who === "ollama") return new OllamaProvider();
  return new MockProvider();
}

