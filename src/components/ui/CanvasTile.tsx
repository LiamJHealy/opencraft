"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatWord } from "@/lib/format";

export type CanvasTileData = {
  id: string;
  word: string; // keep lowercase internally
  x: number;
  y: number;
};

export function CanvasTile({
  tile,
  onMove,
  onRelease,
  onRemove,
}: {
  tile: CanvasTileData;
  onMove: (id: string, x: number, y: number, w: number, h: number) => void;
  onRelease: (id: string, x: number, y: number, w: number, h: number) => void;
  onRemove: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  function dims() {
    const w = ref.current?.offsetWidth ?? 100;
    const h = ref.current?.offsetHeight ?? 28;
    return { w, h };
  }

  function onPointerDown(e: React.PointerEvent) {
    const el = ref.current;
    if (!el) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const rect = el.getBoundingClientRect();
    setOffset({ dx: e.clientX - rect.left, dy: e.clientY - rect.top });
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const canvas = ref.current?.parentElement as HTMLElement | null;
    if (!canvas) return;
    const crect = canvas.getBoundingClientRect();
    const nx = e.clientX - crect.left - offset.dx;
    const ny = e.clientY - crect.top - offset.dy;
    const { w, h } = dims();
    onMove(tile.id, nx, ny, w, h);
  }

  function onPointerUp(e: React.PointerEvent) {
    setDragging(false);
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    const { w, h } = dims();
    onRelease(tile.id, tile.x, tile.y, w, h);
  }

  function onContextMenu(e: React.MouseEvent) {
    e.preventDefault(); // no browser menu
    onRemove(tile.id);
  }

  return (
    <div
      ref={ref}
      onContextMenu={onContextMenu}
      className={cn(
        "absolute inline-flex items-center whitespace-nowrap",
        "rounded-xl border border-zinc-500 bg-white px-3 py-1.5 text-sm text-zinc-900",
        "shadow-sm hover:shadow-md transition-shadow select-none touch-none",
        dragging && "ring-2 ring-zinc-400"
      )}
      style={{ left: tile.x, top: tile.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {formatWord(tile.word)}
    </div>
  );
}
