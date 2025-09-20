// src/components/features/play/PlaySurface.tsx

"use client";

import { useMemo, useRef, useState } from "react";
import { CatalogTile } from "@/components/ui/CatalogTile";
import { CanvasTile, CanvasTileData } from "@/components/ui/CanvasTile";
import { cn } from "@/lib/cn";
import { normalizeName } from "@/lib/normalize";
import { emojiFor } from "@/lib/format";
import HexGridCanvas from "@/components/ui/HexGridCanvas";
import { STARTERS } from "@/constants/starters";

type ElementRow = { id: number; name: string; emoji?: string };

// helpers
function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.hypot(dx, dy);
}
function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function uid() { return Math.random().toString(36).slice(2); }

export default function PlaySurface() {
  // STARTERS is now [{ name, emoji? }]; make a mutable copy if readonly
  const starters = [...STARTERS] as ReadonlyArray<{ name: string; emoji?: string }>;

  // Session-only catalog with immediate starter emojis
  const [elements, setElements] = useState<ElementRow[]>(
    starters.map((s, i) => {
      const n = normalizeName(s.name);
      return {
        id: -(i + 1),
        name: n,
        emoji: s.emoji ?? emojiFor(n),
      };
    })
  );

  // canvas tiles & UI state
  const [tiles, setTiles] = useState<CanvasTileData[]>([]);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // hex glow state
  const [hexHighlight, setHexHighlight] = useState<{ x: number; y: number } | null>(null);

  // trash bin state
  const [trashHot, setTrashHot] = useState(false);
  const TRASH_SIZE = 64;
  const TRASH_PAD = 24;
  const COMBINE_RADIUS = 80;

  // when two tiles are within combine radius during drag
  const [combineHint, setCombineHint] = useState<{ a: string; b: string } | null>(null);

  // which tile is currently being dragged (for styling)
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const elementSet = useMemo(() => new Set(elements.map((e) => e.name)), [elements]);

  function addToSessionCatalog(name: string, emoji?: string) {
    const n = normalizeName(name);
    if (elementSet.has(n)) {
      // upgrade emoji if we learned a better one
      if (emoji) {
        setElements((prev) =>
          prev.map((e) => (e.name === n && !e.emoji ? { ...e, emoji } : e))
        );
      }
      return;
    }
    setElements((prev) =>
      [...prev, { id: -(prev.length + 1), name: n, emoji }]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    );
  }

  function trashRect() {
    const h = canvasRef.current?.clientHeight ?? 0;
    return { left: TRASH_PAD, top: h - TRASH_PAD - TRASH_SIZE, right: TRASH_PAD + TRASH_SIZE, bottom: h - TRASH_PAD };
  }
  function isOverTrash(x: number, y: number, w: number, h: number) {
    const { left, top, right, bottom } = trashRect();
    const cx = x + w / 2, cy = y + h / 2;
    return cx >= left && cx <= right && cy >= top && cy <= bottom;
  }

  /** Find the nearest other tile to a given point (excludeId = moving tile) */
  function nearestToPoint(point: { x: number; y: number }, excludeId?: string) {
    let nearest: CanvasTileData | null = null;
    let nearestD = Infinity;
    for (const t of tiles) {
      if (excludeId && t.id === excludeId) continue;
      const d = dist(point, { x: t.x, y: t.y });
      if (d < nearestD) { nearestD = d; nearest = t; }
    }
    return { nearest, nearestD };
  }

  /** Replace a+b with a single "pending" tile immediately, then morph to result when done */
  async function combineTiles(a: CanvasTileData, b: CanvasTileData) {
    // 1) Optimistic: remove a+b, add pending tile at midpoint
    const mid = midpoint({ x: a.x, y: a.y }, { x: b.x, y: b.y });
    const pendingId = uid();
    setTiles((prev) => [
      ...prev.filter((t) => t.id !== a.id && t.id !== b.id),
      { id: pendingId, word: "Computing…", x: mid.x, y: mid.y, emoji: "⚙️", pending: true },
    ]);

    try {
      const res = await fetch("/api/combine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ left: a.word, right: b.word }),
      });
      const data = await res.json();

      if (!res.ok || data?.error) {
        // Show error state on the pending tile
        setTiles((prev) =>
          prev.map((t) =>
            t.id === pendingId
              ? { ...t, word: "Error", emoji: "🛑", pending: false }
              : t
          )
        );
        console.error("Combine error:", data?.error || res.statusText);
        return;
      }

      const resultWord = normalizeName(String(data.result || "").trim());
      const resultEmoji: string | undefined = data.resultEmoji || undefined;

      // 2) Morph the pending tile into the result
      setTiles((prev) =>
        prev.map((t) =>
          t.id === pendingId
            ? { ...t, word: resultWord, emoji: resultEmoji, pending: false }
            : t
        )
      );

      addToSessionCatalog(resultWord, resultEmoji);
    } catch (err) {
      // Network/unknown failure → error state on pending tile
      setTiles((prev) =>
        prev.map((t) =>
          t.id === pendingId ? { ...t, word: "Error", emoji: "🛑", pending: false } : t
        )
      );
      console.error(err);
    }
  }

  // Catalog → Canvas drag handlers (still supports auto-combine on drop)
  function onCanvasDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) setHexHighlight({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  async function onCanvasDrop(e: React.DragEvent) {
    e.preventDefault();
    setHexHighlight(null);
    setCombineHint(null);

    const wordRaw = e.dataTransfer.getData("text/plain");
    if (!wordRaw) return;

    const word = normalizeName(wordRaw);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dropPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    // Use known catalog emoji (if any) for this dropped word on the tile
    const known = elements.find((el) => el.name === word);
    const newTile: CanvasTileData = { id: uid(), word, x: dropPos.x, y: dropPos.y, emoji: known?.emoji };
    setTiles((prev) => [...prev, newTile]);

    // Find nearest existing tile (not including the just-created one)
    const { nearest, nearestD } = nearestToPoint(dropPos);
    if (nearest && nearestD <= COMBINE_RADIUS) {
      await combineTiles(nearest, newTile);
    }
  }

  // Tile dragging within canvas
  function moveTile(id: string, x: number, y: number, w: number, h: number) {
    const canvas = canvasRef.current;

    // mark which tile is being dragged (for styling)
    if (draggingId !== id) setDraggingId(id);

    // update the moved tile position
    setTiles((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              x: Math.max(0, Math.min(x, (canvas?.clientWidth ?? 0) - w)),
              y: Math.max(0, Math.min(y, (canvas?.clientHeight ?? 0) - h)),
            }
          : t
      )
    );

    // trash hover + hex glow at the tile center
    setTrashHot(isOverTrash(x, y, w, h));
    setHexHighlight({ x: x + w / 2, y: y + h / 2 });

    // Compute nearest neighbor to this new position for the "in-range" cue
    let nearest: CanvasTileData | null = null;
    let nearestD = Infinity;
    for (const t of tiles) {
      if (t.id === id) continue;
      const d = dist({ x, y }, { x: t.x, y: t.y });
      if (d < nearestD) { nearestD = d; nearest = t; }
    }

    if (nearest && nearestD <= COMBINE_RADIUS) {
      setCombineHint({ a: id, b: nearest.id });
    } else {
      setCombineHint(null);
    }
  }

  async function releaseTile(id: string, x: number, y: number, w: number, h: number) {
    const overTrash = isOverTrash(x, y, w, h);
    setDraggingId(null);
    setTrashHot(false);
    setHexHighlight(null);

    if (overTrash) {
      setCombineHint(null);
      setTiles((prev) => prev.filter((t) => t.id !== id));
      return;
    }

    // On release: if within COMBINE_RADIUS of another tile, combine them (show pending immediately)
    let nearest: CanvasTileData | null = null;
    let nearestD = Infinity;
    for (const t of tiles) {
      if (t.id === id) continue;
      const d = dist({ x, y }, { x: t.x, y: t.y });
      if (d < nearestD) { nearestD = d; nearest = t; }
    }

    if (nearest && nearestD <= COMBINE_RADIUS) {
      setCombineHint(null);
      // Create a synthetic "moving" tile with the released coordinates
      const moving = tiles.find((t) => t.id === id);
      const a = nearest;
      const b = moving ? { ...moving, x, y } : { id, word: "", x, y } as CanvasTileData;
      await combineTiles(a, b);
      return;
    }

    setCombineHint(null);
  }

  function removeTile(id: string) {
    setDraggingId(null);
    setTrashHot(false);
    setCombineHint(null);
    setTiles((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="relative h-full w-full">
      <div
        ref={canvasRef}
        className={cn(
          "relative h-full w-full overflow-hidden",
          "bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18),_transparent_60%)]"
        )}
        onDragOver={onCanvasDragOver}
        onDrop={onCanvasDrop}
        onDragLeave={() => {
          setHexHighlight(null);
          setCombineHint(null);
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(30,64,175,0.15),_transparent_55%)]" />

        <HexGridCanvas
          parentRef={canvasRef}
          highlight={hexHighlight}
          hexRadius={24}
          baseAlpha={0.01}
          highlightAlpha={0.25}
          highlightRadius={100}
        />

        {tiles.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-lg font-medium text-white/50">
            Drag words here…
          </div>
        )}

        {tiles.map((t) => (
          <CanvasTile
            key={t.id}
            tile={t}
            isHot={!!(combineHint && (combineHint.a === t.id || combineHint.b === t.id))}
            isDragging={draggingId === t.id}
            onMove={moveTile}
            onRelease={releaseTile}
            onRemove={removeTile}
            onHover={(cx, cy) => setHexHighlight({ x: cx, y: cy })}
            onHoverEnd={() => setHexHighlight(null)}
          />
        ))}

        <div
          className={cn(
            "pointer-events-none absolute z-30",
            "flex items-center justify-center",
            "rounded-2xl border backdrop-blur",
            trashHot
              ? "border-rose-300/60 bg-rose-500/30 text-rose-100 shadow-lg"
              : "border-white/10 bg-white/10 text-white/70 shadow"
          )}
          style={{ left: TRASH_PAD, bottom: TRASH_PAD, width: TRASH_SIZE, height: TRASH_SIZE }}
          aria-hidden
        >
          <svg width="28" height="28" viewBox="0 0 24 24" className="drop-shadow">
            <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" />
            <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <aside
        className="pointer-events-auto absolute right-8 top-32 z-20 w-[min(360px,calc(100%-4rem))] max-h-[70vh] overflow-y-auto rounded-3xl border border-white/10 bg-white/80 p-6 text-slate-900 shadow-2xl backdrop-blur"
      >
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          Discovered this session
        </div>
        <div className="flex flex-wrap gap-2">
          {elements.map((e) => (
            <CatalogTile key={`${e.id}-${e.name}`} name={e.name} emoji={e.emoji} />
          ))}
        </div>
      </aside>
    </div>
  );
}
