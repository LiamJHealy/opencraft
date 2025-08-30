import { normalizeName } from "./normalize";

export function pairKey(a: string, b: string) {
  const [x, y] = [normalizeName(a), normalizeName(b)].sort();
  return `${x}::${y}`;
}

// Proper Case (only first character uppercase)
export function toDisplayName(name: string) {
  const n = name.trim();
  if (!n) return n;
  return n[0].toUpperCase() + n.slice(1).toLowerCase();
}
