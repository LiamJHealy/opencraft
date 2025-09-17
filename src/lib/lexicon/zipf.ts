// Loads a prebuilt { word: zipf } JSON into a Map.
// Enable `"resolveJsonModule": true` in tsconfig.json.

import freqData from "@/lib/lexicon/common_zipf.json";

const FREQ = new Map<string, number>(
  Object.entries(freqData as Record<string, number>).map(([w, z]) => [w.toLowerCase(), Number(z)])
);

export function zipf(w: string): number {
  return FREQ.get(w.toLowerCase()) ?? 0;
}
