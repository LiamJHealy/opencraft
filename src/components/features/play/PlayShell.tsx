// src/components/features/play/PlayShell.tsx

"use client";

import { useEffect, useRef, useState } from "react";
import PlaySurface from "./PlaySurface";

export default function PlayShell() {
  const [surfaceKey, setSurfaceKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

  function extractErrorMessage(data: unknown, fallback?: string) {
    if (data && typeof data === "object" && "error" in data) {
      const candidate = (data as { error?: unknown }).error;
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate;
      }
    }
    return fallback;
  }

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!profileRef.current) return;
      if (!profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function onRestart() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      let data: unknown = null;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      }
      if (!res.ok) {
        const fallback = res.statusText || "Reset failed";
        throw new Error(extractErrorMessage(data, fallback) ?? fallback);
      }

      const explicitError = extractErrorMessage(data);
      if (explicitError) throw new Error(explicitError);
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : "Reset failed");
    } finally {
      setSurfaceKey((k) => k + 1); // remount canvas + refetch catalog
      setBusy(false);
    }
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 z-0">
        <PlaySurface key={surfaceKey} />
      </div>

      <div className="pointer-events-none absolute inset-0 z-30 flex flex-col">
        <header className="pointer-events-auto flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-4 rounded-full bg-white/5 p-2 pr-6 backdrop-blur">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl font-semibold text-slate-900 shadow-lg shadow-slate-900/30">
              OC
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">Playground</span>
              <span className="text-lg font-semibold">OpenCraft</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onRestart}
              disabled={busy}
              className="group relative overflow-hidden rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/40 transition hover:bg-white/20 disabled:cursor-wait disabled:opacity-70"
              title="Reset this session (keep DB)"
            >
              <span className="flex items-center gap-2">
                {busy && (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-transparent" aria-hidden />
                )}
                {busy ? "Resetting…" : "Reset session"}
              </span>
            </button>

            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-xl shadow-lg shadow-slate-900/40 transition hover:bg-white/20"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
              >
                <span role="img" aria-label="Profile">
                  🧑‍🚀
                </span>
              </button>

              {profileOpen && (
                <div
                  className="absolute right-0 mt-3 w-56 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 p-2 text-sm text-white shadow-2xl backdrop-blur"
                  role="menu"
                >
                  <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
                    Account
                  </p>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left transition hover:bg-white/10"
                    role="menuitem"
                  >
                    <span className="text-base" aria-hidden>
                      👤
                    </span>
                    Profile (coming soon)
                  </button>
                  <div className="my-1 h-px bg-white/10" aria-hidden />
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left transition hover:bg-white/10"
                    role="menuitem"
                  >
                    <span className="text-base" aria-hidden>
                      🔐
                    </span>
                    Log in
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left transition hover:bg-white/10"
                    role="menuitem"
                  >
                    <span className="text-base" aria-hidden>
                      🚪
                    </span>
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {err && (
          <div className="pointer-events-auto mx-auto mt-2 w-[min(480px,calc(100%-4rem))] rounded-2xl border border-rose-500/30 bg-rose-500/20 px-6 py-3 text-sm text-rose-100 shadow-lg backdrop-blur">
            {err}
          </div>
        )}

        <div className="pointer-events-none mt-auto flex justify-between px-8 pb-8 text-[0.65rem] font-medium uppercase tracking-[0.4em] text-white/30">
          <span>Imagine. Combine. Discover.</span>
          <span>v0.1</span>
        </div>
      </div>
    </main>
  );
}
