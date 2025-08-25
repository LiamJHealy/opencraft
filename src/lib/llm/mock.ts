import { CombineInput, CombineOutput, CombineProvider } from "./types";
import { normalizeName } from "@/lib/normalize";

// Small hand-written dictionary for nice demos
const DICT: Record<string, string> = {
  "water::fire": "steam",
  "earth::water": "mud",
  "earth::fire": "lava",
  "fire::air": "energy",
  "water::air": "rain",
  "earth::air": "dust",
};

function key(a: string, b: string) {
  const [x, y] = [normalizeName(a), normalizeName(b)].sort();
  return `${x}::${y}`;
}

export class MockProvider implements CombineProvider {
  async combine({ left, right }: CombineInput): Promise<CombineOutput> {
    const k = key(left, right);
    const dictHit = DICT[k];
    if (dictHit) {
      return { result: normalizeName(dictHit), reasoning: "mock:dict", provider: "mock" };
    }
    // Fallback deterministic pattern
    return { result: normalizeName(`${left} ${right}`), reasoning: "mock:fallback", provider: "mock" };
  }
}
