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

type CombineHint = {
  ids: string[];
  fromCatalog?: boolean;
  label: string;
  position: { x: number; y: number };
};

type CelebrationState = {
  id: string;
  word: string;
  emoji: string;
  position: { x: number; y: number };
  tagline: string;
};

const LOADING_EMOJIS = ["\u{1F300}", "\u{1F9E0}", "\u26A1", "\u2728", "\u{1F308}"];
const CELEBRATION_TAGLINES = [
  "Word fusion unlocked!",
  "Combo discovered!",
  "Fresh creation!",
  "Brain spark!",
  "New recipe unlocked!",
];




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
  const [loadingEmojiIndex, setLoadingEmojiIndex] = useState(0);
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
  const [celebration, setCelebration] = useState<CelebrationState | null>(null);

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
  const combineHintTimeoutRef = useRef<number | null>(null);

  function showCombineHint(hint: CombineHint) {
    if (combineHintTimeoutRef.current) {
      window.clearTimeout(combineHintTimeoutRef.current);
      combineHintTimeoutRef.current = null;
    }
    setCombineHint(hint);
  }

  function hideCombineHint(delay = 600) {
    if (combineHintTimeoutRef.current) {
      window.clearTimeout(combineHintTimeoutRef.current);
      combineHintTimeoutRef.current = null;
    }
    if (delay <= 0) {
      setCombineHint(null);
      return;
    }
    combineHintTimeoutRef.current = window.setTimeout(() => {
      setCombineHint(null);
      combineHintTimeoutRef.current = null;
    }, delay);
  }

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
        hideCombineHint(0);
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
    const full = "Drop words to craft combos ✨";
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

  useEffect(() => {
    if (!dailyLoading) {
      setLoadingEmojiIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setLoadingEmojiIndex((index) => (index + 1) % LOADING_EMOJIS.length);
    }, 420);
    return () => window.clearInterval(timer);
  }, [dailyLoading]);

  useEffect(() => {
    if (!celebration) return;
    const timeout = window.setTimeout(() => setCelebration(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [celebration]);

  useEffect(() => () => {
    if (combineHintTimeoutRef.current) {
      window.clearTimeout(combineHintTimeoutRef.current);
    }
  }, []);

  const catalogElements = useMemo(
    () => [...starterElements, ...discoveredElements],
    [starterElements, discoveredElements]
  );
  const elementSet = useMemo(() => new Set(catalogElements.map((e) => e.name)), [catalogElements]);

  const allTargetsComplete = useMemo(() => {
    if (!daily?.targets?.length) return false;
    return daily.targets.every((target) => completedTargets.has(target.name));
  }, [daily, completedTargets]);

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
  const loadingTextClasses = cn(
    "flex items-center gap-2 text-sm font-semibold",
    isDark ? "text-white/80" : "text-slate-600"
  );
  const loadingSubTextClasses = cn(
    "text-[0.68rem] font-medium uppercase tracking-[0.2em]",
    isDark ? "text-white/45" : "text-slate-500"
  );
  const loadingEmoji = LOADING_EMOJIS[loadingEmojiIndex];
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
    const mid = midpoint({ x: a.x, y: a.y }, { x: b.x, y: b.y });
    const pendingId = uid();
    const pendingTile: CanvasTileData = {
      id: pendingId,
      word: "brewing new word",
      x: mid.x,
      y: mid.y,
      emoji: "\u{1FA84}",
      pending: true,
    };
    setTiles((prev) => [
      ...prev.filter((t) => t.id !== a.id && t.id !== b.id),
      pendingTile,
    ]);

    try {
      const res = await fetch("/api/combine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ left: a.word, right: b.word }),
      });
      const data = await res.json();

      if (!res.ok || data?.error) {
        setTiles((prev) =>
          prev.map((t) =>
            t.id === pendingId
              ? { ...t, word: "try again", emoji: "\u{1F4A5}", pending: false }
              : t
          )
        );
        console.error("Combine error:", data?.error || res.statusText);
        return;
      }

      const resultWord = normalizeName(String(data.result || "").trim());
      const resultEmoji = data.resultEmoji ? String(data.resultEmoji) : emojiFor(resultWord);
      const tagline = CELEBRATION_TAGLINES[Math.floor(Math.random() * CELEBRATION_TAGLINES.length)];

      setTiles((prev) =>
        prev.map((t) =>
          t.id === pendingId
            ? { ...t, word: resultWord, emoji: resultEmoji, pending: false }
            : t
        )
      );

      addToSessionCatalog(resultWord, resultEmoji);
      setCelebration({
        id: pendingId,
        word: properCase(resultWord),
        emoji: resultEmoji,
        position: mid,
        tagline,
      });
    } catch (err) {
      setTiles((prev) =>
        prev.map((t) =>
          t.id === pendingId ? { ...t, word: "network glitch", emoji: "\u{1F4A5}", pending: false } : t
        )
      );
      console.error(err);
    }
  }


  // Catalog → Canvas drag handlers (still supports auto-combine on drop)
  function onCanvasDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setHexHighlight(point);

    const { nearest, nearestD } = nearestToPoint(point);
    if (nearest && nearestD <= COMBINE_RADIUS) {
      const position = midpoint(point, { x: nearest.x, y: nearest.y });
      const label = "Drop to fuse! ⚡";

      showCombineHint({ ids: [nearest.id], fromCatalog: true, label, position });
    } else {
      hideCombineHint();
    }
  }

  async function onCanvasDrop(e: React.DragEvent) {
    e.preventDefault();
    setHexHighlight(null);
    hideCombineHint(0);

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
    const center = { x: x + w / 2, y: y + h / 2 };
    setTrashHot(isOverTrash(x, y, w, h));
    setHexHighlight(center);

    // Compute nearest neighbor to this new position for the "in-range" cue
    const { nearest, nearestD } = nearestToPoint(center, id);

    if (nearest && nearestD <= COMBINE_RADIUS) {
      const hintPosition = midpoint({ x: nearest.x, y: nearest.y }, center);
      showCombineHint({ ids: [id, nearest.id], fromCatalog: false, label: "Drop to fuse! ⚡", position: hintPosition });
    } else {
      hideCombineHint();
    }
  }

  async function releaseTile(id: string, x: number, y: number, w: number, h: number) {
    const overTrash = isOverTrash(x, y, w, h);
    setDraggingId(null);
    setTrashHot(false);
    setHexHighlight(null);

    if (overTrash) {
      hideCombineHint(0);
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
      hideCombineHint(0);
      // Create a synthetic "moving" tile with the released coordinates
      const moving = tiles.find((t) => t.id === id);
      const a = nearest;
      const b = moving ? { ...moving, x, y } : { id, word: "", x, y } as CanvasTileData;
      await combineTiles(a, b);
      return;
    }

    hideCombineHint();
  }

  function removeTile(id: string) {
    setDraggingId(null);
    setTrashHot(false);
    hideCombineHint(0);
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
    hideCombineHint(0);
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
                {promptText || "Drop words to begin"}
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

        {combineHint && (
          <div
            className="pointer-events-none absolute z-30 flex -translate-x-1/2 -translate-y-full flex-col items-center gap-1 oc-combine-pop"
            style={{ left: combineHint.position.x, top: combineHint.position.y }}
          >
            <span
              className={cn(
                "rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] shadow-lg",
                isDark ? "bg-amber-300/90 text-slate-900" : "bg-amber-400/90 text-slate-900"
              )}
            >
              {combineHint.label}
            </span>
          </div>
        )}

        {celebration && (
          <div
            className={cn(
              "pointer-events-none absolute z-40 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center oc-celebration",
              isDark ? "text-slate-100" : "text-slate-900"
            )}
            style={{ left: celebration.position.x, top: celebration.position.y }}
            aria-live="polite"
          >
            <span className="text-4xl drop-shadow" aria-hidden>
              {celebration.emoji}
            </span>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] shadow-lg",
                isDark ? "bg-emerald-400/90 text-slate-900" : "bg-emerald-500/90 text-white"
              )}
            >
              {celebration.tagline}
            </span>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-[0.75rem] font-semibold shadow",
                isDark ? "bg-slate-900/70 text-white" : "bg-white/90 text-slate-700"
              )}
            >
              {celebration.word}
            </span>
          </div>
        )}

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
          <span className="flex items-center gap-2">
            Word catalog
            <span aria-hidden className="oc-emoji-bounce text-lg">✨</span>
          </span>
          <span
            className={cn(
              "text-[0.7rem] font-semibold uppercase tracking-[0.35em]",
              isDark ? "text-white/40" : "text-slate-400"
            )}
          >
            Drag & drop to play
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
                  {dailyLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="oc-emoji-wiggle" aria-hidden>{loadingEmoji}</span>
                      Loading
                    </span>
                  ) : (
                    "Simulate new day"
                  )}
                </button>
              </div>
            </div>
            {dailyLoading ? (
              <div className={loadingTextClasses}>
                <span className="oc-emoji-wiggle text-lg" aria-hidden>{loadingEmoji}</span>
                <div className="flex flex-col leading-tight">
                  <span>Brewing daily challenge...</span>
                  <span className={loadingSubTextClasses}>Shuffling every syllable for you.</span>
                </div>
              </div>
            ) : dailyError ? (
              <p className={cn(catalogErrorTextClasses, "flex items-center gap-2")}>
                <span aria-hidden>??</span>
                {dailyError}
              </p>
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
                      steps={target.steps}
                      recipes={target.recipes}
                      requiredStarters={target.requiredStarters}
                      completed={completedTargets.has(target.name)}
                    />
                  ))}
                </div>
                {allTargetsComplete && (
                  <div className="mt-3 rounded-3xl border border-emerald-200/60 bg-emerald-50/80 px-4 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                    Daily goals complete! Check back tomorrow for fresh words.
                  </div>
                )}
              </div>
            ) : (
              <p className={catalogEmptyTextClasses}>No targets available.</p>
            )}
          </section>
          <div className={cn("h-px", catalogDividerClasses)} aria-hidden />
          <section>
            <p className={catalogSectionLabelClasses}>Starting words</p>
            {dailyLoading ? (
              <div className={loadingTextClasses}>
                <span className="oc-emoji-wiggle text-lg" aria-hidden>{loadingEmoji}</span>
                <span>Fetching starter words...</span>
              </div>
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
