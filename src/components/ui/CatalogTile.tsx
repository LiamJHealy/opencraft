"use client";

import { cn } from "@/lib/cn";
import { formatWord } from "@/lib/format";

export function CatalogTile({ name }: { name: string }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        // keep raw lowercase for logic
        e.dataTransfer.setData("text/plain", name);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className={cn(
        // content-width box that can sit next to others
        "inline-flex items-center whitespace-nowrap",
        // rounded rect + padding + darker outline/text + subtle shadow
        "rounded-xl border border-zinc-400 bg-white px-3 py-1.5 text-sm text-zinc-900",
        "shadow-sm hover:shadow-md transition-shadow",
        // drag affordances
        "cursor-grab active:cursor-grabbing select-none"
      )}
      title={name}
    >
      {formatWord(name)}
    </div>
  );
}
