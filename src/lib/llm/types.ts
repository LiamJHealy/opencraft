export type CombineInput = { left: string; right: string };

export type CombineOutput = {
  result: string;        // canonicalized, e.g. "steam"
  reasoning?: string;    // optional debug
  provider?: string;     // "mock" | "ollama" | etc.
  complexity?: number;   // 1..5
  emoji?: string;      // single emoji char/sequence
};

export interface CombineProvider {
  readonly name?: string;
  combine(input: CombineInput): Promise<CombineOutput>;
}
