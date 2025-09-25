"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

export function HoneypotButton({
  href,
  isDark,
  title = "Support via Honeypot",
  bottomOffset = 37,     // ↑ move up by increasing this
  rightOffset = 16,      // ← move left if needed
  emoji = "🍯",          // add any emoji you like
  showJarIcon = false,    // toggle SVG jar on/off
}: {
  href: string;
  isDark: boolean;
  title?: string;
  bottomOffset?: number;
  rightOffset?: number;
  emoji?: string;
  showJarIcon?: boolean;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={title}
      title={title}
      className={cn(
        "fixed z-50 inline-flex items-center gap-2 rounded-full px-3 py-2",
        "shadow-lg backdrop-blur transition pointer-events-auto select-none",
        isDark
          ? "bg-amber-400/90 text-slate-900 hover:bg-amber-300"
          : "bg-amber-500/90 text-white hover:bg-amber-400",
        "focus:outline-none focus:ring-2",
        isDark ? "focus:ring-amber-300/50" : "focus:ring-amber-600/40"
      )}
      style={{ bottom: bottomOffset, right: rightOffset }}
    >
      {/* Emoji */}
      <span aria-hidden className="text-lg leading-none">{emoji}</span>

      {/* Optional jar icon */}
      {showJarIcon && (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="drop-shadow"
        >
          <path
            d="M7 7h10a3 3 0 0 1 3 3v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-6a3 3 0 0 1 3-3Z"
            fill="currentColor"
            opacity="0.9"
          />
          <path
            d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"
            stroke="currentColor"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      )}

      {/* Optional text label (hide on small screens if you want) */}
      <span className="hidden sm:inline text-sm font-semibold tracking-wide">
        Honeypot
      </span>
    </Link>
  );
}
