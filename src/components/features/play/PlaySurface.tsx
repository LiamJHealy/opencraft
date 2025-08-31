"use client";

import { useMemo, useRef, useState } from "react";
import { CatalogTile } from "@/components/ui/CatalogTile";
import { CanvasTile, CanvasTileData } from "@/components/ui/CanvasTile";
import { cn } from "@/lib/cn";
import { normalizeName } from "@/lib/normalize";
import HexGridCanvas from "@/components/ui/HexGridCanvas";
import { STARTERS } from "@/constants/starters";

type ElementRow = { id: number; name: string };

// helpers
function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}
function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function uid() {
  return Math.random().toString(36).slice(2);
}

export default function PlaySurface() {
  // 🔹 Session-only catalog
  const [elements, setElements] = useState<ElementRow[]>(
    STARTERS.map((n, i) => ({ id: -(i + 1), name: n })) // negative ids: local-only
  );

  // canvas tiles & UI state
  const [tiles, setTiles] = useState<CanvasTileData[]>([]);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // hex glow state
  const [hexHighlight, setHexHighlight] = useState<{ x: number; y: number } | null>(null);

  // trash bin state
  const [trashHot, setTrashHot] = useState(false);
  const TRASH_SIZE = 64;
  const TRASH_PAD = 8;
  const COMBINE_RADIUS = 80;

  const elementSet = useMemo(() => new Set(elements.map((e) => e.name)), [elements]);

  function addToSessionCatalog(name: string) {
    const n = normalizeName(name);
    if (elementSet.has(n)) return;
    setElements((prev) =>
      [...prev, { id: -(prev.length + 1), name: n }].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      )
    );
  }

  function trashRect() {
    const h = canvasRef.current?.clientHeight ?? 0;
    return {
      left: TRASH_PAD,
      top: h - TRASH_PAD - TRASH_SIZE,
      right: TRASH_PAD + TRASH_SIZE,
      bottom: h - TRASH_PAD,
    };
  }
  function isOverTrash(x: number, y: number, w: number, h: number) {
    const { left, top, right, bottom } = trashRect();
    const cx = x + w / 2;
    const cy = y + h / 2;
    return cx >= left && cx <= right && cy >= top && cy <= bottom;
  }

  // Catalog → Canvas drag handlers
  function onCanvasDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) setHexHighlight({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }
  async function onCanvasDrop(e: React.DragEvent) {
    e.preventDefault();
    setHexHighlight(null);

    const word = e.dataTransfer.getData("text/plain");
    if (!word) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dropPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    const newTile: CanvasTileData = { id: uid(), word, x: dropPos.x, y: dropPos.y };
    setTiles((prev) => [...prev, newTile]);

    // find nearest neighbor among existing tiles to auto-combine if close
    const others = tiles;
    let nearest: CanvasTileData | null = null;
    let nearestD = Infinity;
    for (const t of others) {
      const d = dist(dropPos, { x: t.x, y: t.y });
      if (d < nearestD) {
        nearestD = d;
        nearest = t;
      }
    }

    if (nearest && nearestD <= COMBINE_RADIUS) {
      try {
        const res = await fetch("/api/combine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ left: nearest.word, right: word }),
        });
        const data = await res.json();
        if (!res.ok || data?.error) {
          console.error("Combine error:", data?.error || res.statusText);
          return;
        }
        const resultWord = normalizeName(String(data.result || "").trim());
        const mid = midpoint({ x: nearest.x, y: nearest.y }, dropPos);

        // replace two source tiles with result tile
        setTiles((prev) => [
          ...prev.filter((t) => t.id !== nearest!.id && t.id !== newTile.id),
          { id: uid(), word: resultWord, x: mid.x, y: mid.y },
        ]);

        // 🔹 Add to session catalog because the user created it in THIS session
        addToSessionCatalog(resultWord);
      } catch (err) {
        console.error(err);
      }
    }
  }

  // Tile dragging within canvas
  function moveTile(id: string, x: number, y: number, w: number, h: number) {
    const canvas = canvasRef.current;
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
    setTrashHot(isOverTrash(x, y, w, h));
    setHexHighlight({ x: x + w / 2, y: y + h / 2 });
  }
  function releaseTile(id: string, x: number, y: number, w: number, h: number) {
    const overTrash = isOverTrash(x, y, w, h);
    setTrashHot(false);
    setHexHighlight(null);
    if (overTrash) {
      setTiles((prev) => prev.filter((t) => t.id !== id));
    }
  }
  function removeTile(id: string) {
    setTrashHot(false);
    setTiles((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="h-full grid grid-cols-[4fr_1fr] min-h-0">
      {/* Left: Canvas */}
      <div
        ref={canvasRef}
        className={cn("relative h-full overflow-hidden p-2 bg-gray-010")}
        onDragOver={onCanvasDragOver}
        onDrop={onCanvasDrop}
        onDragLeave={() => setHexHighlight(null)}
      >
        {/* Hex overlay behind tiles */}
        <HexGridCanvas
          parentRef={canvasRef}
          highlight={hexHighlight}
          hexRadius={24}
          baseAlpha={0.01}
          highlightAlpha={0.25}
          highlightRadius={100}
        />

        {/* hint text */}
        {tiles.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-zinc-500">
            Drag words here…
          </div>
        )}

        {/* tiles */}
        {tiles.map((t) => (
          <CanvasTile
            key={t.id}
            tile={t}
            onMove={moveTile}
            onRelease={releaseTile}
            onRemove={removeTile}
            onHover={(cx, cy) => setHexHighlight({ x: cx, y: cy })}
            onHoverEnd={() => setHexHighlight(null)}
          />
        ))}

        {/* Trash bin (bottom-left) */}
        <div
          className={cn(
            "pointer-events-none absolute z-20",
            "flex items-center justify-center",
            "rounded-lg",
            trashHot ? "bg-rose-100/70 border border-rose-300" : "bg-zinc-200/40 border border-zinc-300/60"
          )}
          style={{ left: TRASH_PAD, bottom: TRASH_PAD, width: TRASH_SIZE, height: TRASH_SIZE }}
          aria-hidden
        >
          <svg width="28" height="28" viewBox="0 0 24 24" className="drop-shadow-sm">
            <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" />
            <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Right: Session-only Catalog */}
      <aside className="border-l bg-white h-full overflow-y-auto">
        <div className="p-3">
          <div className="mb-2 text-sm font-semibold text-zinc-600">Discovered (this session)</div>
          <div className="flex flex-wrap gap-2">
            {elements.map((e) => (
              <CatalogTile key={`${e.id}-${e.name}`} name={e.name} />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
