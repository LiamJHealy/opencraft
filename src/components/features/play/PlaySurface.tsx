// src/components/features/play/PlaySurface.tsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CatalogTile } from "@/components/ui/CatalogTile";
import { CanvasTile, CanvasTileData } from "@/components/ui/CanvasTile";
import { cn } from "@/lib/cn";
import { normalizeName } from "@/lib/normalize";
import { emojiFor, properCase } from "@/lib/format";
import { useTheme } from "@/components/providers/ThemeProvider";
import HexGridCanvas from "@/components/ui/HexGridCanvas";
import { TargetTile } from "@/components/features/play/TargetTile";
import type { DailyPayload } from "@/lib/daily";

type ElementRow = { id: number; name: string; emoji?: string };

type CombineHint = { ids: string[]; fromCatalog?: boolean };

// helpers
function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.hypot(dx, dy);
}
function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function uid() { return Math.random().toString(36).slice(2); }
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function PlaySurface() {
  const [dailySeed, setDailySeed] = useState<string>("today");
  const [daily, setDaily] = useState<DailyPayload | null>(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [dailyError, setDailyError] = useState<string | null>(null);
  const [completedTargets, setCompletedTargets] = useState<Set<string>>(new Set());

  const starterElements = useMemo(() => {
    if (!daily?.starters) return [];
    return daily.starters.map((starter, index) => {
      const normalized = normalizeName(starter.name);
      const emoji = starter.emoji && starter.emoji.trim() ? starter.emoji : emojiFor(normalized);
      return {
        id: -(index + 1),
        name: normalized,
        emoji,
      };
    });
  }, [daily]);

  const requiredStarterSummary = useMemo(() => {
    if (!daily?.targets) return [] as string[];
    const set = new Set<string>();
    for (const target of daily.targets) {
      for (const starter of target.requiredStarters ?? []) {
        const normalized = normalizeName(starter);
        if (!set.has(normalized)) set.add(normalized);
      }
    }
    return Array.from(set);
  }, [daily]);

  const [discoveredElements, setDiscoveredElements] = useState<ElementRow[]>([]);

  const { isDark } = useTheme();

  // canvas tiles & UI state
  const [tiles, setTiles] = useState<CanvasTileData[]>([]);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const catalogRef = useRef<HTMLDivElement | null>(null);
  const [catalogPosition, setCatalogPosition] = useState({ x: 32, y: 120 });
  const catalogDragRef = useRef({
    active: false,
    pointerId: 0,
    offsetX: 0,
    offsetY: 0,
  });

  function updateCatalogPosition(clientX: number, clientY: number) {
    const width = catalogRef.current?.offsetWidth ?? 0;
    const height = catalogRef.current?.offsetHeight ?? 0;
    const maxX = Math.max(CATALOG_PADDING, window.innerWidth - width - CATALOG_PADDING);
    const maxY = Math.max(CATALOG_PADDING, window.innerHeight - height - CATALOG_PADDING);
    setCatalogPosition({
      x: clamp(clientX - catalogDragRef.current.offsetX, CATALOG_PADDING, maxX),
      y: clamp(clientY - catalogDragRef.current.offsetY, CATALOG_PADDING, maxY),
    });
  }

  function beginCatalogDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    const rect = catalogRef.current?.getBoundingClientRect();
    catalogDragRef.current = {
      active: true,
      pointerId: event.pointerId,
      offsetX: event.clientX - (rect?.left ?? event.clientX),
      offsetY: event.clientY - (rect?.top ?? event.clientY),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onCatalogPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!catalogDragRef.current.active || event.pointerId !== catalogDragRef.current.pointerId) return;
    event.preventDefault();
    updateCatalogPosition(event.clientX, event.clientY);
  }

  function endCatalogDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!catalogDragRef.current.active || event.pointerId !== catalogDragRef.current.pointerId) return;
    catalogDragRef.current.active = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  // hex glow state
  const [hexHighlight, setHexHighlight] = useState<{ x: number; y: number } | null>(null);

  // trash bin state
  const [trashHot, setTrashHot] = useState(false);
  const TRASH_SIZE = 64;
  const TRASH_PAD = 24;
  const COMBINE_RADIUS = 80;
  const CATALOG_PADDING = 24;

  // when two tiles are within combine radius during drag
  const [combineHint, setCombineHint] = useState<CombineHint | null>(null);

  // which tile is currently being dragged (for styling)
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const [promptText, setPromptText] = useState("");
  const [caretVisible, setCaretVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadDaily() {
      setDailyLoading(true);
      setDailyError(null);
      try {
        const query = dailySeed === "today" ? "" : `?seed=${encodeURIComponent(dailySeed)}`;
        const res = await fetch(`/api/daily${query}`, { cache: "no-store" });
        if (!res.ok) {
          let errorMessage = `Request failed (${res.status})`;
          try {
            const data = await res.json();
            if (data && typeof data.error === "string") errorMessage = data.error;
          } catch {
            // swallow JSON errors
          }
          throw new Error(errorMessage);
        }
        const payload = await res.json();
        if (cancelled) return;
        setDaily(payload);
        setCompletedTargets(new Set());
        setTiles([]);
        setDiscoveredElements([]);
        setCombineHint(null);
        setDraggingId(null);
        setHexHighlight(null);
        setTrashHot(false);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to load daily set";
        setDaily(null);
        setDailyError(message);
      } finally {
        if (!cancelled) {
          setDailyLoading(false);
        }
      }
    }

    loadDaily();
    return () => {
      cancelled = true;
    };
  }, [dailySeed]);
  useEffect(() => {
    const full = "Drag words here...";
    let index = 0;
    let direction: 1 | -1 = 1;
    let timer = 0;

    function schedule(delay: number) {
      timer = window.setTimeout(step, delay);
    }

    function step() {
      setPromptText(full.slice(0, index));
      if (direction === 1) {
        if (index < full.length) {
          index += 1;
          schedule(90);
        } else {
          direction = -1;
          schedule(1400);
        }
      } else {
        if (index > 0) {
          index -= 1;
          schedule(55);
        } else {
          direction = 1;
          schedule(400);
        }
      }
    }

    schedule(240);

    const blink = window.setInterval(() => setCaretVisible((visible) => !visible), 480);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(blink);
    };
  }, []);

  const catalogElements = useMemo(
    () => [...starterElements, ...discoveredElements],
    [starterElements, discoveredElements]
  );
  const elementSet = useMemo(() => new Set(catalogElements.map((e) => e.name)), [catalogElements]);

  const catalogContainerClasses = cn(
    "pointer-events-auto absolute z-20 w-[min(360px,calc(100%-4rem))] max-h-[70vh] overflow-y-auto rounded-3xl border p-6 shadow-2xl backdrop-blur transition-colors duration-300",
    isDark
      ? "border-white/10 bg-slate-900/80 text-white shadow-slate-900/40"
      : "border-slate-900/10 bg-white/90 text-slate-900 shadow-slate-900/15"
  );
  const catalogHandleClasses = cn(
    "mb-4 flex cursor-grab select-none items-center justify-between text-xs font-semibold uppercase tracking-[0.3em]",
    isDark ? "text-white/50" : "text-slate-500"
  );
  const catalogSectionLabelClasses = cn(
    "mb-2 text-xs font-semibold uppercase tracking-[0.3em]",
    isDark ? "text-white/45" : "text-slate-500"
  );
  const catalogDividerClasses = isDark ? "bg-white/10" : "bg-slate-900/10";
  const catalogEmptyTextClasses = cn(
    "text-sm italic",
    isDark ? "text-white/40" : "text-slate-500"
  );

  const catalogInfoTextClasses = cn(
    "text-[0.65rem] uppercase tracking-[0.3em]",
    isDark ? "text-white/40" : "text-slate-500"
  );
  const catalogErrorTextClasses = cn(
    "text-sm font-semibold",
    isDark ? "text-rose-300" : "text-rose-600"
  );
  const primaryCatalogButtonClasses = cn(
    "rounded-full px-4 py-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.3em] transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60",
    isDark
      ? "bg-white/10 text-white hover:bg-white/20 focus:ring-white/30 focus:ring-offset-slate-900"
      : "bg-slate-900 text-white hover:bg-slate-700 focus:ring-slate-900/30 focus:ring-offset-white"
  );
  const secondaryCatalogButtonClasses = cn(
    "rounded-full px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60",
    isDark
      ? "border border-white/20 text-white/80 hover:bg-white/10 focus:ring-white/20 focus:ring-offset-slate-900"
      : "border border-slate-900/20 text-slate-700 hover:bg-slate-900/10 focus:ring-slate-900/20 focus:ring-offset-white"
  );
  function addToSessionCatalog(name: string, emoji?: string) {
    const normalized = normalizeName(name);
    if (elementSet.has(normalized)) {
      if (emoji) {
        setDiscoveredElements((prev) =>
          prev.map((entry) => (entry.name === normalized && !entry.emoji ? { ...entry, emoji } : entry))
        );
      }
      return;
    }
    setDiscoveredElements((prev) =>
      [...prev, { id: prev.length + 1, name: normalized, emoji }]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    );
    if (daily?.targets?.some((target) => target.name === normalized) && !completedTargets.has(normalized)) {
      setCompletedTargets((prev) => {
        if (prev.has(normalized)) return prev;
        const next = new Set(prev);
        next.add(normalized);
        return next;
      });
    }
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
      { id: pendingId, word: "Computingâ€¦", x: mid.x, y: mid.y, emoji: "âš™ï¸", pending: true },
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
              ? { ...t, word: "Error", emoji: "ðŸ›‘", pending: false }
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
      // Network/unknown failure â†’ error state on pending tile
      setTiles((prev) =>
        prev.map((t) =>
          t.id === pendingId ? { ...t, word: "Error", emoji: "ðŸ›‘", pending: false } : t
        )
      );
      console.error(err);
    }
  }

  // Catalog â†’ Canvas drag handlers (still supports auto-combine on drop)
  function onCanvasDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setHexHighlight(point);

    const { nearest, nearestD } = nearestToPoint(point);
    if (nearest && nearestD <= COMBINE_RADIUS) {
      setCombineHint({ ids: [nearest.id], fromCatalog: true });
    } else {
      setCombineHint(null);
    }
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
    const known = catalogElements.find((el) => el.name === word);
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
      setCombineHint({ ids: [id, nearest.id] });
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
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div
              className={cn(
                "flex items-center gap-3 rounded-full px-6 py-3 shadow-lg backdrop-blur-md transition-colors",
                isDark ? "bg-slate-950/60" : "bg-white/80"
              )}
            >
              <span className="oc-gradient-text text-xl font-semibold tracking-[0.2em]">
                {promptText || "Â "}
              </span>
              <span
                className={cn(
                  "h-6 w-[2px] rounded-full transition-opacity",
                  caretVisible ? "opacity-80" : "opacity-20",
                  isDark ? "bg-white" : "bg-slate-900"
                )}
                aria-hidden
              />
            </div>
          </div>
        )}

        {tiles.map((t) => (
          <CanvasTile
            key={t.id}
            tile={t}
            isHot={!!combineHint?.ids.includes(t.id)}
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
        ref={catalogRef}
        className={catalogContainerClasses}
        style={{ left: catalogPosition.x, top: catalogPosition.y }}
      >
        <div
          className={catalogHandleClasses}
          onPointerDown={beginCatalogDrag}
          onPointerMove={onCatalogPointerMove}
          onPointerUp={endCatalogDrag}
          onPointerCancel={endCatalogDrag}
          role="presentation"
        >
          <span>Word catalog</span>
          <span
            className={cn(
              "text-[1.3rem] font-medium tracking-[0.2em]",
              isDark ? "text-white/40" : "text-slate-400"
            )}
          >
            âœ¦âœ¦
          </span>
        </div>
        <div className="space-y-4">
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className={catalogSectionLabelClasses}>Daily targets</p>
              <div className="flex flex-wrap items-center gap-2">
                {dailySeed !== "today" && (
                  <button
                    type="button"
                    onClick={() => setDailySeed("today")}
                    disabled={dailyLoading}
                    className={secondaryCatalogButtonClasses}
                  >
                    Today
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDailySeed(`${Date.now()}`)}
                  disabled={dailyLoading}
                  className={primaryCatalogButtonClasses}
                >
                  {dailyLoading ? "Loading…" : "Simulate new day"}
                </button>
              </div>
            </div>
            {dailyLoading ? (
              <p className={catalogEmptyTextClasses}>Loading daily set.</p>
            ) : dailyError ? (
              <p className={catalogErrorTextClasses}>{dailyError}</p>
            ) : daily?.targets?.length ? (
              <div className="space-y-3">
                <p className={catalogInfoTextClasses}>
                  Seed {daily.seed.toUpperCase()} - Targets {daily.targets.length} - Reachable {daily.reachableCount}
                </p>
                {requiredStarterSummary.length > 0 && (
                  <p className={catalogInfoTextClasses}>
                    Core starters: {requiredStarterSummary.map((name) => properCase(name)).join(" / ")}
                  </p>
                )}
                <div className="grid gap-3">
                  {daily.targets.map((target) => (
                    <TargetTile
                      key={`target-${target.elementId}`}
                      name={target.name}
                      emoji={target.emoji ?? emojiFor(target.name)}
                      difficulty={target.difficulty}
                      steps={target.steps}
                      recipes={target.recipes}
                      requiredStarters={target.requiredStarters}
                      completed={completedTargets.has(target.name)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <p className={catalogEmptyTextClasses}>No targets available.</p>
            )}
          </section>
          <div className={cn("h-px", catalogDividerClasses)} aria-hidden />
          <section>
            <p className={catalogSectionLabelClasses}>Starting words</p>
            {dailyLoading ? (
              <p className={catalogEmptyTextClasses}>Loading…</p>
            ) : starterElements.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {starterElements.map((entry) => (
                  <CatalogTile key={`${entry.id}-${entry.name}`} name={entry.name} emoji={entry.emoji} />
                ))}
              </div>
            ) : (
              <p className={catalogEmptyTextClasses}>No starters available.</p>
            )}
          </section>
          <div className={cn("h-px", catalogDividerClasses)} aria-hidden />
          <section>
            <p className={catalogSectionLabelClasses}>Discovered this session</p>
            {discoveredElements.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {discoveredElements.map((entry) => (
                  <CatalogTile
                    key={`${entry.id}-${entry.name}`}
                    name={entry.name}
                    emoji={entry.emoji ?? emojiFor(entry.name)}
                  />
                ))}
              </div>
            ) : (
              <p className={catalogEmptyTextClasses}>Combine tiles to discover new words.</p>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}































