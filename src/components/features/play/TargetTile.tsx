'use client';

import { properCase } from "@/lib/format";
import { cn } from "@/lib/cn";

const unlockedStyles = "border-emerald-200 bg-emerald-50/90 text-emerald-900";

const lockedStyles = "border-slate-200 bg-slate-100/90 text-slate-500";

const targetLabel = "Target";

export type TargetTileProps = {
  name: string;
  emoji: string;
  steps: number;
  recipes: Array<{ left: string; right: string }>;
  requiredStarters: string[];
  completed: boolean;
};

export function TargetTile({
  name,
  emoji,
  steps,
  recipes,
  requiredStarters,
  completed,
}: TargetTileProps) {
  const isLocked = !completed;

  const cardClasses = cn(
    "relative flex h-full min-h-[5.5rem] flex-col justify-between gap-1.5 rounded-3xl border px-4 py-2.5",
    "shadow-sm transition-all",
    completed ? "ring-2 ring-offset-2 ring-emerald-400" : "",
    isLocked ? lockedStyles : unlockedStyles,
  );

  const displayEmoji = emoji;
  const displayName = properCase(name);
  const showDetails = completed;

  const starterLabel = completed && requiredStarters.length
    ? requiredStarters.map((s) => properCase(s)).join(" / ")
    : "???";

  const recipeLabel = completed && recipes.length
    ? recipes.map((r) => `${properCase(r.left)} + ${properCase(r.right)}`).join(" / ")
    : null;

  const statusBadge = completed ? (
    <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-emerald-700">
      <span aria-hidden>🎯</span> Complete
    </span>
  ) : (
    <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold text-slate-500">
      <span aria-hidden>🔒</span> Locked
    </span>
  );

  return (
    <div
      className={cardClasses}
      aria-live="polite"
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
    >
      {statusBadge}

      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden>
          {displayEmoji}
        </span>
        <div className="flex flex-col">
          <span
            className={cn(
              "text-sm font-semibold uppercase tracking-[0.3em]",
              isLocked ? "opacity-50" : "opacity-70",
            )}
          >
            {targetLabel}
          </span>
          <span className="text-lg font-semibold leading-tight">{displayName}</span>
        </div>
      </div>

      <div
        className={cn(
          "text-xs font-medium leading-snug",
          isLocked ? "opacity-60" : "opacity-80",
        )}
      >
        {showDetails && (
          <>
            <p>
              Steps: <span className="font-semibold">{steps}</span>
            </p>
            <p>
              Core starters: <span className="font-semibold">{starterLabel}</span>
            </p>
            {recipeLabel && (
              <p className="mt-0.5 text-[0.7rem] opacity-70">Recipes: {recipeLabel}</p>
            )}
          </>
        )}
        {isLocked && (
          <p className="mt-1.5 text-[0.7rem] italic">Combine starters to reveal this target.</p>
        )}
      </div>
    </div>
  );
}


