import { normalizeName } from "@/lib/normalize";
import { pairKey } from "@/lib/text";
import type { CombineInput, CombineOutput, CombineProvider } from "./types";

// Canonical results (with "wind" combos)
const CANON: Record<string, string> = {
  [pairKey("fire", "water")]: "steam",
  [pairKey("earth", "water")]: "mud",
  [pairKey("earth", "fire")]: "lava",
  [pairKey("wind", "earth")]: "dust",
  [pairKey("wind", "water")]: "rain",
  [pairKey("wind", "fire")]: "energy",
};

// Result aliases -> canonical result
const ALIASES: Record<string, string> = {
  vapor: "steam",
  "water vapor": "steam",
  vapour: "steam",
  // normalize "air" results (if a model ever outputs "air", treat as "wind")
  air: "wind",
};

function canonicalFor(a: string, b: string): string | null {
  return CANON[pairKey(a, b)] ?? null;
}
function applyAliases(name: string) {
  const n = normalizeName(name);
  return ALIASES[n] ?? n;
}

export class CanonicalWrapper implements CombineProvider {
  constructor(private inner: CombineProvider) {}
  async combine(input: CombineInput): Promise<CombineOutput> {
    const { left, right } = input;
    const canon = canonicalFor(left, right);
    if (canon) return { result: canon, provider: "canon" };
    const out = await this.inner.combine(input);
    return { ...out, result: applyAliases(out.result) };
  }
}
