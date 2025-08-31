// src/components/ui/HexGridCanvas.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };

// Accept both MutableRefObject and RefObject, with nullable HTMLElement inside
type AnyRef<T> = React.MutableRefObject<T> | React.RefObject<T>;

export default function HexGridCanvas({
  parentRef,
  highlight,
  hexRadius = 24,
  baseAlpha = 0.02,
  highlightAlpha = 0.20,
  highlightRadius = 100,
}: {
  parentRef: AnyRef<HTMLElement | null>;
  highlight: Point | null;
  hexRadius?: number;
  baseAlpha?: number;
  highlightAlpha?: number;
  highlightRadius?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [sizeKey, setSizeKey] = useState(0);
  useEffect(() => {
    const parent = parentRef.current; 
    if (!parent) return;
    const ro = new ResizeObserver(() => setSizeKey((k) => k + 1));
    ro.observe(parent);
    return () => ro.disconnect();
  }, [parentRef]);

  useEffect(() => {
    const parent = parentRef.current;
    const canvas = canvasRef.current;
    if (!parent || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;

    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const r = hexRadius;
    const wHex = 2 * r;
    const hHex = Math.sqrt(3) * r;
    const stepX = 1.5 * r;
    const stepY = hHex;
    const margin = 2;

    const cols = Math.ceil((w - margin * 2) / stepX) + 2;
    const rows = Math.ceil((h - margin * 2) / stepY) + 2;

    function drawHex(
      ctx2d: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      strokeAlpha: number,
      lw = 1
    ) {
      ctx2d.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 180) * (60 * i);
        const x = cx + r * Math.cos(ang);
        const y = cy + r * Math.sin(ang);
        if (i === 0) ctx2d.moveTo(x, y);
        else ctx2d.lineTo(x, y);
      }
      ctx2d.closePath();
      ctx2d.lineWidth = lw;
      ctx2d.strokeStyle = `rgba(24,24,27,${strokeAlpha})`;
      ctx2d.stroke();
    }

    for (let c = -1; c < cols; c++) {
      const cx = margin + c * (1.5 * r);
      const offsetY = c % 2 !== 0 ? stepY / 2 : 0;
      for (let rIdx = -1; rIdx < rows; rIdx++) {
        const cy = margin + offsetY + rIdx * stepY;
        if (cx < -wHex || cx > w + wHex || cy < -hHex || cy > h + hHex) continue;

        let alpha = baseAlpha;
        let lw = 1;

        if (highlight) {
          const dx = cx - highlight.x;
          const dy = cy - highlight.y;
          const d = Math.hypot(dx, dy);
          if (d <= highlightRadius) {
            const t = 1 - d / highlightRadius;
            alpha = baseAlpha + (highlightAlpha - baseAlpha) * (t * t);
            lw = 1 + Math.max(0.5, t) * 0.8;
          }
        }

        drawHex(ctx, cx, cy, alpha, lw);
      }
    }
  }, [parentRef, sizeKey, highlight, hexRadius, baseAlpha, highlightAlpha, highlightRadius]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[1]"
      aria-hidden
    />
  );
}
