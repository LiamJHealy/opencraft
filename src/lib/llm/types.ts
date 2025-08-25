export type CombineInput = { left: string; right: string };
export type CombineOutput = {
  result: string;        // canonicalized, e.g. "steam"
  reasoning?: string;    // optional debug
  provider?: string;     // "mock" | "ollama" | etc.
};

export interface CombineProvider {
  combine(input: CombineInput): Promise<CombineOutput>;
}
