"use client";

import { useEffect, useState } from "react";
import { properCase, emojiFor } from "@/lib/format";

/**
 * Catalog chip for a discovered word.
 * - If `emoji` is provided, show it immediately.
 * - Otherwise fall back to emojiFor(name) and then call /api/emoji/ensure once.
 */
export function CatalogTile({ name, emoji }: { name: string; emoji?: string }) {
  const [displayEmoji, setDisplayEmoji] = useState<string>(emoji ?? emojiFor(name));

  // Only fetch if we weren't given an emoji
  useEffect(() => {
    if (emoji) return;
    let cancelled = false;
    fetch("/api/emoji/ensure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.emoji) setDisplayEmoji(d.emoji);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [name, emoji]);

  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("text/plain", name);
    e.dataTransfer.effectAllowed = "copy";
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="inline-flex items-center whitespace-nowrap
                 rounded-full border bg-white px-3 py-1.5
                 text-base md:text-m text-zinc-900 shadow-sm hover:shadow-md
                 transition-shadow cursor-grab active:cursor-grabbing select-none"
      title={properCase(name)}
    >
      <span aria-hidden className="mr-1">{displayEmoji}</span>
      <span className="font-medium">{properCase(name)}</span>
    </div>
  );
}

export default CatalogTile;
