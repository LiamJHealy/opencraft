// src/lib/llm/types.ts

export type CombineInput = { left: string; right: string };

export type CombineOutput = {
  result: string;        // canonicalized, e.g. "steam"
  provider?: string;     // "mock" | "ollama" | "openai"
  emoji?: string;        // single emoji char/sequence
};

export interface CombineProvider {
  readonly name?: string;
  combine(input: CombineInput): Promise<CombineOutput>;
}
