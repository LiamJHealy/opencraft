"use client";

import { cn } from "@/lib/cn";

/**
 * Text-only news ticker with bottom & side offsets so it doesn't overlap
 * bottom-right honeypot or bottom-left trash bin.
 */
export function NewsTicker({
  isDark,
  speedSec = 28,
  bottomOffset = 40,   // ← raise the line off the bottom (px)
  leftGutter = 100,     // ← keep away from edges (px)
  rightGutter = 150,
}: {
  isDark: boolean;
  speedSec?: number;
  bottomOffset?: number;
  leftGutter?: number;
  rightGutter?: number;
}) {
  const line =
    "This game was developed with ❤️ alot of ☕ and not much 😴️️️️ㅤ│ㅤ🚧 Currently in Beta testing️️️ㅤ│ㅤ📢 Contribute to future development by offering suggestions️️️ㅤ│ㅤDonate via 🍯 to show your support️️️ㅤ│ㅤ🎉 Have fun and good luck 🏆";

  return (
    <div
      className={cn(
        "fixed z-50 pointer-events-none select-none", // under your z-[9999] celebrations
      )}
      // raise off bottom, inset from left/right
      style={{
        left: leftGutter,
        right: rightGutter,
        bottom: bottomOffset,
      }}
      role="region"
      aria-label="Game info"
    >
      {/* Single, thin line. No box, no backdrop, no border. */}
      <div className="relative w-full overflow-hidden">
        {/* The moving text */}
        <div
          className={cn(
            "oc-animate-ticker whitespace-nowrap will-change-transform",
            // subtle color; a bit dimmer in dark mode
            isDark ? "text-white/70" : "text-slate-700"
          )}
          style={{
            animation: `oc-ticker ${speedSec}s linear infinite`,
            // vertically center the text within its own line box
            lineHeight: "2",
            fontSize: "0.9rem",
            textShadow: isDark ? "0 1px 2px rgba(0,0,0,0.25)" : "none",
          }}
        >
          <span className="pr-12">{line}</span>
          <span className="pr-12">{line}</span>
          <span className="pr-12">{line}</span>
        </div>
      </div>
    </div>
  );
}
