// src/components/branding/Logo.tsx
import { cn } from "@/lib/cn";

export default function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        // strong, crisp text
        "font-extrabold tracking-tight leading-none select-none",
        // subtle lift so it stands out over busy backgrounds
        // "drop-shadow-[0_1px_0_rgba(0,0,0,0.1)]",
        className
      )}
    >
      <span className="text-zinc-900">Open</span>
      <span className="text-gray-300">Craft</span>
    </span>
  );
}
