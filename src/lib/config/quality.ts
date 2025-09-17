// src/lib/config/quality.ts
// Tuning knobs for scoring + duplicate punishment.

export const ZIPF_MIN = 3.4;              // drop rare words outright
export const ZIPF_STRONG_BONUS_START = 4.5;

export const OVERUSE_SOFT_START = 2;      // after this many global uses, start heavy penalties
export const OVERUSE_HARD_BLOCK = 3;      // absolute cap: block candidates used this many times globally

export const OVERUSE_SOFT_WEIGHT = 3.5;   // multiplier on ln(uses - soft_start + 1)
export const OVERUSE_RECENT_WINDOW_H = 24;// "recent" = last N hours
export const OVERUSE_RECENT_WEIGHT = 1.2; // per-recent-use penalty

export const DEBUG_COMBINE = process.env.DEBUG_COMBINE === "1";
