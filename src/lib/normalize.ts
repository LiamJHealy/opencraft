export function normalizeName(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " "); // collapse multiple spaces
}
