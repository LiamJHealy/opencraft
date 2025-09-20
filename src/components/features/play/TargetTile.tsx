'use client';

import { properCase } from "@/lib/format";
import { cn } from "@/lib/cn";

const difficultyStyles: Record<"easy" | "medium" | "hard", string> = {
  easy: "border-emerald-200 bg-emerald-50/90 text-emerald-900",
  medium: "border-amber-200 bg-amber-50/90 text-amber-900",
  hard: "border-rose-300 bg-rose-50/90 text-rose-900",
};

const difficultyLabels: Record<"easy" | "medium" | "hard", string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export type TargetTileProps = {
  name: string;
  emoji: string;
  difficulty: "easy" | "medium" | "hard";
  steps: number;
  recipes: Array<{ left: string; right: string }>;
  requiredStarters: string[];
  completed: boolean;
};

export function TargetTile({
  name,
  emoji,
  difficulty,
  steps,
  recipes,
  requiredStarters,
  completed,
}: TargetTileProps) {
  const baseClasses = cn(
    "relative flex h-full min-h-[6.5rem] flex-col justify-between gap-2 rounded-3xl border px-4 py-3",
    "shadow-sm transition-all",
    completed ? "ring-2 ring-offset-2 ring-emerald-400" : "",
    difficultyStyles[difficulty],
  );

  const starterLabel = requiredStarters.length
    ? requiredStarters.map((s) => properCase(s)).join(" / ")
    : "-";

  const recipeLabel = recipes.length
    ? recipes.map((r) => `${properCase(r.left)} + ${properCase(r.right)}`).join(" / ")
    : null;

  return (
    <div className={baseClasses} aria-live="polite">
      {completed && (
        <span
          className="absolute right-3 top-3 rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-emerald-700"
        >
          ✓ Done
        </span>
      )}

      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden>
          {emoji}
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-semibold uppercase tracking-[0.3em] opacity-70">
            {difficultyLabels[difficulty]}
          </span>
          <span className="text-lg font-semibold leading-tight">{properCase(name)}</span>
        </div>
      </div>

      <div className="text-xs font-medium leading-relaxed opacity-80">
        <p>
          Steps: <span className="font-semibold">{steps}</span>
        </p>
        <p>
          Core starters: <span className="font-semibold">{starterLabel}</span>
        </p>
        {recipeLabel && (
          <p className="mt-1 text-[0.7rem] opacity-70">Recipes: {recipeLabel}</p>
        )}
      </div>
    </div>
  );
}
