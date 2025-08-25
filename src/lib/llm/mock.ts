import { CombineInput, CombineOutput, CombineProvider } from "./types";
import { normalizeName } from "@/lib/normalize";

// ✅ Keys are alphabetically sorted: "air::earth", "fire::water", etc.
const DICT: Record<string, string> = {
  "air::earth": "dust",
  "air::fire": "energy",
  "air::water": "rain",
  "earth::fire": "lava",
  "earth::water": "mud",
  "fire::water": "steam",
};

function key(a: string, b: string) {
  const [x, y] = [normalizeName(a), normalizeName(b)].sort();
  return `${x}::${y}`;
}

export class MockProvider implements CombineProvider {
  async combine({ left, right }: CombineInput): Promise<CombineOutput> {
    const dictHit = DICT[key(left, right)];
    if (dictHit) {
      return { result: normalizeName(dictHit), reasoning: "mock:dict", provider: "mock" };
    }
    // Fallback if not in DICT
    return { result: normalizeName(`${left} ${right}`), reasoning: "mock:fallback", provider: "mock" };
  }
}
