import { getStartersForToday } from "@/lib/starters";

// export an array of { name, emoji? }
export const STARTERS = getStartersForToday();

// export const STARTER_NAMES = STARTERS.map(s => s.name) as readonly string[];

