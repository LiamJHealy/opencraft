// src/components/ui/CanvasTile.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { emojiFor, properCase } from "@/lib/format";

export type CanvasTileData = {
  id: string;
  word: string;
  x: number;
  y: number;
  emoji?: string;
  /** while waiting for combine result */
  pending?: boolean;
};

type Props = {
  tile: CanvasTileData;
  onMove: (id: string, x: number, y: number, w: number, h: number) => void;
  onRelease: (id: string, x: number, y: number, w: number, h: number) => void;
  onRemove?: (id: string) => void;
  onHover?: (cx: number, cy: number) => void;
  onHoverEnd?: () => void;

  /** Visually indicate this tile is in combine range */
  isHot?: boolean;

  /** True while the user is dragging this tile */
  isDragging?: boolean;
};

export function CanvasTile({
  tile,
  onMove,
  onRelease,
  onRemove,
  onHover,
  onHoverEnd,
  isHot,
  isDragging,
}: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  // Measure width/height for hover center + bounds
  useEffect(() => {
    function measure() {
      const el = elRef.current;
      if (!el) return;
      setDims({ w: el.offsetWidth, h: el.offsetHeight });
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (elRef.current) ro.observe(elRef.current);
    return () => ro.disconnect();
  }, []);

  const displayEmoji = tile.emoji ?? emojiFor(tile.word);
  const displayText = tile.pending ? tile.word : properCase(tile.word);

  // Hover -> let HexGrid know the center point for the glow
  function handleMouseEnter() {
    if (!onHover || !elRef.current) return;
    const rect = elRef.current.getBoundingClientRect();
    const cx = tile.x + rect.width / 2;
    const cy = tile.y + rect.height / 2;
    onHover(cx, cy);
  }
  function handleMouseLeave() {
    onHoverEnd?.();
  }

  // Dragging with mouse
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const offsetX = startX - tile.x;
    const offsetY = startY - tile.y;

    function onMoveWin(ev: MouseEvent) {
      const nx = ev.clientX - offsetX;
      const ny = ev.clientY - offsetY;
      onMove(tile.id, nx, ny, dims.w, dims.h);
    }
    function onUpWin(ev: MouseEvent) {
      const nx = ev.clientX - offsetX;
      const ny = ev.clientY - offsetY;
      onRelease(tile.id, nx, ny, dims.w, dims.h);
      window.removeEventListener("mousemove", onMoveWin);
      window.removeEventListener("mouseup", onUpWin);
    }

    window.addEventListener("mousemove", onMoveWin);
    window.addEventListener("mouseup", onUpWin);
  }

  function onContextMenu(e: React.MouseEvent) {
    if (!onRemove) return;
    e.preventDefault();
    onRemove(tile.id);
  }

  return (
    <div
      ref={elRef}
      className={cn(
        "absolute z-10 select-none cursor-grab active:cursor-grabbing",
        "rounded-full border bg-white/95 px-4 py-2 text-base md:text-lg font-semibold text-slate-900",
        "border-slate-200/70 shadow-sm transition-shadow duration-150 will-change-transform",
        tile.pending && "oc-animate-pulse-soft border-amber-300 bg-amber-50/95 text-amber-900 shadow-lg",
        isHot && "scale-105 ring-2 ring-amber-400 shadow-md",
        isDragging ? "opacity-100" : "hover:shadow-lg"
      )}
      style={{ left: tile.x, top: tile.y }}
      title={displayText}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-hot={isHot ? "true" : "false"}
      data-pending={tile.pending ? "true" : "false"}
      aria-live={tile.pending ? "polite" : undefined}
    >
      <span
        className={cn(
          "mr-2 inline-block text-xl",
          tile.pending && "animate-spin"
        )}
        aria-hidden
      >
        {displayEmoji}
      </span>
      <span>{displayText}</span>
    </div>
  );
}

export default CanvasTile;
