// src/lib/format.ts

// Hand-picked core result emojis (matches your seed)
const CORE_EMOJI: Record<string, string> = {
  steam:  "♨️",
  mud:    "🟫",
  lava:   "🌋",
  dust:   "💨",
  rain:   "🌧️",
  energy: "⚡",
};

export function emojiFor(name: string) {
  const n = name.toLowerCase().trim();

  // Starters
  if (n === "fire")  return "🔥";
  if (n === "water") return "💧";
  if (n === "earth") return "🌍";
  if (n === "wind")  return "🌬️";  // ← switched from "air" to "wind"

  // Exact core results
  if (CORE_EMOJI[n]) return CORE_EMOJI[n];

  // Heuristics / synonyms (fallbacks)
  if (/\bsteam|vapo(u)?r\b/i.test(n)) return "♨️";
  if (/\bmud|soil|clay|sand|dust\b/i.test(n)) return "🟫";
  if (/\blava|magma|volcano\b/i.test(n)) return "🌋";
  if (/\bdust|smoke|haze\b/i.test(n)) return "💨";
  if (/\brain|shower|drizzle\b/i.test(n)) return "🌧️";
  if (/\benergy|lightning|electric|power\b/i.test(n)) return "⚡";
  if (/\bice|snow|frost\b/i.test(n)) return "❄️";
  if (/\bstone|rock|metal|gem\b/i.test(n)) return "💎";

  return "🧩";
}

export function properCase(name: string) {
  const n = name.trim();
  if (!n) return n;
  return n[0].toUpperCase() + n.slice(1).toLowerCase();
}

// Final display string, e.g. "🔥 Fire"
export function formatWord(name: string) {
  return `${emojiFor(name)} ${properCase(name)}`;
}
