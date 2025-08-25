import { normalizeName } from "./normalize";

export function pairKey(a: string, b: string) {
  const [x, y] = [normalizeName(a), normalizeName(b)].sort();
  return `${x}::${y}`;
}

export function toDisplayName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}
