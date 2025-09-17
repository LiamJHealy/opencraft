// src/lib/log.ts
import { DEBUG_COMBINE } from "@/lib/config/quality";

export function dlog(...args: any[]) {
  if (DEBUG_COMBINE) {
    // Prefix makes grepping easy
    console.log("[combine]", ...args);
  }
}

// neat number printing
export const r2 = (x: number) => Math.round(x * 100) / 100;
