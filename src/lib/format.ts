export function emojiFor(name: string) {
  const n = name.toLowerCase().trim();
  if (n === "fire") return "🔥";
  if (n === "water") return "💧";
  if (n === "earth") return "🌍";
  if (n === "air") return "🌀";

  // Optional heuristics (tweak as you wish)
  if (/\bsteam|fog|cloud\b/i.test(n)) return "☁️";
  if (/\bmud|soil|sand|dust\b/i.test(n)) return "🟫";
  if (/\benergy|lightning|electric\b/i.test(n)) return "⚡";
  if (/\bice|snow|frost\b/i.test(n)) return "❄️";
  if (/\bstone|rock|metal\b/i.test(n)) return "💎";

  return "🧩";
}

export function properCase(name: string) {
  const n = name.trim();
  if (!n) return n;
  return n[0].toUpperCase() + n.slice(1).toLowerCase();  // e.g., "metal bird" -> "Metal bird"
}

// Final display string, e.g. "🔥 Fire"
export function formatWord(name: string) {
  return `${emojiFor(name)} ${properCase(name)}`;
}
