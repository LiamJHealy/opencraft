"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CatalogTile } from "@/components/ui/CatalogTile";
import { CanvasTile, CanvasTileData } from "@/components/ui/CanvasTile";
import { cn } from "@/lib/cn";
import { normalizeName } from "@/lib/normalize";
import HexGridCanvas from "@/components/ui/HexGridCanvas";

type ElementRow = { id: number; name: string };

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
  const [elements, setElements] = useState<ElementRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [tiles, setTiles] = useState<CanvasTileData[]>([]);
  // const canvasRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [hexHighlight, setHexHighlight] = useState<{ x: number; y: number } | null>(null);

  // ----- NEW: trash bin UI state/geometry -----
  const [trashHot, setTrashHot] = useState(false);
  const TRASH_SIZE = 64;      // px
  const TRASH_PAD = 8;        // px from edges
  function trashRect() {
    const h = canvasRef.current?.clientHeight ?? 0;
    return {
      left: TRASH_PAD,
      top: h - TRASH_PAD - TRASH_SIZE,
      right: TRASH_PAD + TRASH_SIZE,
      bottom: h - TRASH_PAD,
      cx: TRASH_PAD + TRASH_SIZE / 2,
      cy: h - TRASH_PAD - TRASH_SIZE / 2,
    };
  }
  function isOverTrash(x: number, y: number, w: number, h: number) {
    const { left, top, right, bottom } = trashRect();
    const cx = x + w / 2;
    const cy = y + h / 2;
    return cx >= left && cx <= right && cy >= top && cy <= bottom;
  }

  const COMBINE_RADIUS = 80;

  // load discovered elements
  useEffect(() => {
    (async () => {
      try {
        setLoadingList(true);
        const res = await fetch("/api/elements", { cache: "no-store" });
        const data = (await res.json()) as ElementRow[];
        setElements(
          data.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
        );
      } finally {
        setLoadingList(false);
      }
    })();
  }, []);

  const elementSet = useMemo(() => new Set(elements.map((e) => e.name)), [elements]);
  function addElementToCatalog(name: string) {
    if (elementSet.has(name)) return;
    setElements((prev) =>
      [...prev, { id: -1, name }].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    );
  }

  function onCanvasDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setHexHighlight({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }

  async function onCanvasDrop(e: React.DragEvent) {
    e.preventDefault();
    const word = e.dataTransfer.getData("text/plain");
    if (!word) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dropPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    // place new tile
    const newTile: CanvasTileData = { id: uid(), word, x: dropPos.x, y: dropPos.y };
    setTiles((prev) => [...prev, newTile]);

    // find nearest neighbor among existing tiles
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
        const raw = String(data.result || "").trim();
        const resultWord = normalizeName(raw);
        const mid = midpoint({ x: nearest.x, y: nearest.y }, dropPos);

        setTiles((prev) => [
          ...prev.filter((t) => t.id !== nearest!.id && t.id !== newTile.id),
          { id: uid(), word: resultWord, x: mid.x, y: mid.y },
        ]);

        if (!elementSet.has(resultWord)) addElementToCatalog(resultWord);
      } catch (err) {
        console.error(err);
      }
    }

    setHexHighlight(null);

  }

  // ----- UPDATED: move & release handlers now get width/height too -----
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
    // highlight trash bin if the tile center is inside it
    setTrashHot(isOverTrash(x, y, w, h));

    // 🔥 NEW: drive the hex highlight from the tile center while dragging
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
        className={cn(
          "relative h-full overflow-hidden p-2",
          // "bg-[radial-gradient(circle_at_20px_20px,_#e9e9eb_1px,_transparent_1px)]",
          // "bg-[length:40px_40px]",
          // "bg-white"
        )}
        onDragOver={onCanvasDragOver}
        onDrop={onCanvasDrop}
        onDragLeave={() => setHexHighlight(null)}
      >
        {/* HEX OVERLAY */}
        <HexGridCanvas parentRef={canvasRef} highlight={hexHighlight} />

        {/* hint text */}
        {tiles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
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

        {/* ----- NEW: trash bin target (bottom-left) ----- */}
        <div
          className={cn(
            "pointer-events-none absolute",
            "flex items-center justify-center",
            "rounded-lg",
            trashHot ? "bg-rose-100/70 border border-rose-300" : "bg-zinc-200/40 border border-zinc-300/60"
          )}
          style={{
            left: TRASH_PAD,
            bottom: TRASH_PAD,
            width: TRASH_SIZE,
            height: TRASH_SIZE,
          }}
          aria-hidden
        >
          {/* simple bin icon */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill={trashHot ? "#b91c1c" : "#525252"}
            className="drop-shadow-sm"
          >
            <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" />
            <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Right: Catalog */}
      <aside className="border-l bg-white h-full overflow-y-auto">
        <div className="p-3">
          <div className="mb-2 text-sm font-semibold text-zinc-600">Discovered</div>
          {loadingList && <div className="text-sm text-zinc-500">Loading…</div>}
          <div className="flex flex-wrap gap-2">
            {elements.map((e) => (
              <CatalogTile key={`${e.id}-${e.name}`} name={e.name} />
            ))}
            {!loadingList && elements.length === 0 && (
              <div className="text-sm text-zinc-500">
                No elements yet. Use the combine UI or drop some results into the canvas.
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
