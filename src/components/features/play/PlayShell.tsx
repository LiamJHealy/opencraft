"use client";

import { useState } from "react";
import Image from "next/image";
import PlaySurface from "./PlaySurface";
import Logo from "@/components/branding/Logo";

export default function PlayShell() {
  const [surfaceKey, setSurfaceKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onRestart() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || res.statusText);
      setSurfaceKey((k) => k + 1); // remount canvas + refetch catalog
    } catch (e: any) {
      setErr(e?.message || "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="h-screen flex flex-col bg-zinc-50">
      {/* Header: 5% */}
      <div className="h-[5vh] border-b bg-white flex items-center px-4 justify-between">
        <Logo className="text-2xl md:text-3xl" />

        <button
          onClick={() => setSurfaceKey((k) => k + 1)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm hover:bg-zinc-50"
          title="Reset this session (keep DB)"
        >
          Reset
        </button>


        </div>

      {/* Optional inline error banner */}
      {err && (
        <div className="px-4 py-2 text-sm text-rose-700 bg-rose-50 border-b border-rose-200">
          {err}
        </div>
      )}

      {/* Middle: fills remaining space (canvas + catalog live here) */}
      <div className="flex-1 min-h-0">
        <PlaySurface key={surfaceKey} />
      </div>

      {/* Footer: 5% with the watermark INSIDE it */}
      <footer className="h-[5vh] border-t bg-white flex items-center px-4 justify-between">
        <div className="flex items-center gap-2">
          {/* Next.js watermark/logo */}
          <Image
            src="/next.svg"
            alt="Next.js Logo"
            width={80}
            height={16}
            className="opacity-70"
            priority
          />
        </div>
        {/* right side placeholder (e.g., status) */}
        <div className="text-xs text-zinc-500">v0.1</div>
      </footer>
    </main>
  );
}
