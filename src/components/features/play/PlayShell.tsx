// src/components/features/play/PlayShell.tsx

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/providers/SessionProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import PlaySurface from "./PlaySurface";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function PlayShell() {
  const { isDark, toggleTheme } = useTheme();
  const { user, setUser } = useSession();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const themeEmoji = isDark ? "🌞" : "🌙";
  const themeToggleLabel = `Switch to ${isDark ? "day" : "night"} mode`;
  const accountEmoji = user ? "😊" : "🔒";
  const accountButtonLabel = user ? "Open account menu" : "Open login menu";
  const aliasDisplay = user?.alias ?? user?.email ?? "Guest";
  const accountMenuHeading = user ? "Account" : "Guest access";

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

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
    } catch (error) {
      console.error(error);
    } finally {
      setProfileOpen(false);
      router.replace("/login");
    }
  }

  const shellClasses = cx(
    "relative h-screen w-screen overflow-hidden transition-colors duration-300",
    isDark ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-900"
  );
  const brandContainerClasses = cx(
    "flex items-center gap-4 rounded-full p-2 pr-6 backdrop-blur transition-colors duration-300",
    isDark ? "bg-white/5" : "border border-slate-900/10 bg-white/85 shadow-sm"
  );
  const brandMarkClasses = cx(
    "flex h-12 w-12 items-center justify-center rounded-3xl text-xl font-semibold shadow-lg transition-colors duration-300",
    isDark ? "bg-white text-slate-900 shadow-slate-900/30" : "bg-slate-900 text-slate-50 shadow-slate-900/20"
  );
  const themeButtonClasses = cx(
    "flex h-11 w-11 items-center justify-center rounded-full text-2xl shadow-lg transition",
    isDark
      ? "bg-white/10 text-white shadow-slate-900/30 hover:bg-white/20"
      : "bg-slate-900 text-white shadow-slate-900/15 hover:bg-slate-800"
  );
  const profileButtonClasses = cx(
    "flex h-11 w-11 items-center justify-center rounded-full border text-xl shadow-lg transition",
    isDark
      ? "border-white/10 bg-white/10 text-white shadow-slate-900/40 hover:bg-white/20"
      : "border-slate-900/10 bg-white/85 text-slate-900 shadow-slate-900/10 hover:bg-slate-900/10"
  );
  const aliasBadgeClasses = cx(
    "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-lg transition-colors duration-300",
    isDark
      ? "border-white/15 bg-white/10 text-white shadow-slate-900/40"
      : "border-slate-900/10 bg-white/90 text-slate-900 shadow-slate-900/10"
  );
  const aliasBadgeLabelClasses = cx(
    "text-xs font-semibold uppercase tracking-[0.3em]",
    isDark ? "text-white/60" : "text-slate-500"
  );
  const aliasBadgeValueClasses = cx(
    "text-sm font-semibold",
    isDark ? "text-white" : "text-slate-900"
  );
  const menuClasses = cx(
    "absolute right-0 mt-3 w-56 overflow-hidden rounded-3xl border p-2 text-sm shadow-2xl backdrop-blur transition-colors duration-300",
    isDark
      ? "border-white/10 bg-slate-900/90 text-white"
      : "border-slate-900/10 bg-white text-slate-900 shadow-slate-900/15"
  );
  const menuItemClasses = cx(
    "flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left transition",
    isDark ? "hover:bg-white/10" : "hover:bg-slate-900/5"
  );
  const dividerClasses = isDark ? "bg-white/10" : "bg-slate-900/10";
  const footerTextClasses = cx(
    "pointer-events-none mt-auto flex justify-between px-8 pb-8 text-[0.65rem] font-medium uppercase tracking-[0.4em]",
    isDark ? "text-white/30" : "text-slate-500"
  );

  return (
    <main className={shellClasses}>
      <div className="absolute inset-0 z-0">
        <PlaySurface />
      </div>

      <div className="pointer-events-none absolute inset-0 z-30 flex flex-col">
        <header className="pointer-events-auto flex items-center justify-between px-8 py-6">
          <div className={brandContainerClasses}>
            <div className={brandMarkClasses}>
              🚀
            </div>
            <div className="flex flex-col">
              <span
                className={cx(
                  "text-xs font-semibold uppercase tracking-[0.3em]",
                  isDark ? "text-white/50" : "text-slate-500"
                )}
              >
                Daily Race
              </span>
              <span className="text-lg font-semibold">OpenCraft</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className={cx(themeButtonClasses, "pointer-events-auto")}
              aria-label={themeToggleLabel}
              aria-pressed={isDark}
              title={themeToggleLabel}
            >
              <span aria-hidden>{themeEmoji}</span>
            </button>

            {user && (
              <div className={cx(aliasBadgeClasses, "pointer-events-auto")} role="status" aria-live="polite">
                <span className={aliasBadgeLabelClasses}>Alias</span>
                <span className={aliasBadgeValueClasses}>{aliasDisplay}</span>
              </div>
            )}

            <div ref={profileRef} className="pointer-events-auto relative">
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                className={profileButtonClasses}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                aria-label={accountButtonLabel}
              >
                <span aria-hidden>{accountEmoji}</span>
              </button>

              {profileOpen && (
                <div className={menuClasses} role="menu">
                  <p
                    className={cx(
                      "px-3 pb-2 text-xs font-semibold uppercase tracking-[0.3em]",
                      isDark ? "text-white/40" : "text-slate-500"
                    )}
                  >
                    {accountMenuHeading}
                  </p>
                  {user ? (
                    <>
                      <button
                        type="button"
                        className={menuItemClasses}
                        role="menuitem"
                        onClick={() => {
                          setProfileOpen(false);
                          router.push("/profile");
                        }}
                      >
                        <span className="text-base" aria-hidden>
                          🧭
                        </span>
                        Profile
                      </button>
                      <div className={cx("my-1 h-px", dividerClasses)} aria-hidden />
                      <button
                        type="button"
                        className={menuItemClasses}
                        role="menuitem"
                        onClick={handleLogout}
                      >
                        <span className="text-base" aria-hidden>
                          🚪
                        </span>
                        Log out
                      </button>
                    </>
                  ) : (
                    <Link
                      href="/login"
                      className={cx(menuItemClasses, "no-underline")}
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                    >
                      <span className="text-base" aria-hidden>
                        🔐
                      </span>
                      Log in
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={footerTextClasses}>
          <span />
          <span>Imagine. Combine. Discover.</span>
        </div>
      </div>
    </main>
  );
}
