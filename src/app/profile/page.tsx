"use client";

import Link from "next/link";
import { useTheme } from "@/components/providers/ThemeProvider";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function ProfilePage() {
  const { isDark, toggleTheme } = useTheme();

  // ---------------- PLACEHOLDERS (no session/data yet) ----------------
  // TODO: replace with real values from your API/session later.
  const avatarEmoji = "🙂";
  const alias = "Adventurer";
  const stats = {
    totalPlays: 0,
    bestRank: "-",
    totalDiscoveries: 0,
    streak: 0,
  };
  const awards: Array<{ id: string; title: string; emoji?: string; hint?: string }> = [];
  type GameRow = { id: string; date: string; target: string; rank?: number | null; moves?: number | null; result?: "Win" | "Loss" };
  const history: GameRow[] = [];

  const containerClasses = cx(
    "relative min-h-screen overflow-hidden transition-colors duration-300",
    isDark ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900"
  );
  const themeButtonClasses = cx(
    "flex h-11 w-11 items-center justify-center rounded-full text-2xl shadow-lg transition",
    isDark
      ? "bg-white/10 text-white shadow-slate-900/30 hover:bg-white/20"
      : "bg-slate-900 text-white shadow-slate-900/15 hover:bg-slate-800"
  );
  const cardBase = cx(
    "rounded-3xl border shadow-2xl backdrop-blur",
    isDark ? "border-white/10 bg-slate-900/70 shadow-slate-950/40" : "border-slate-900/10 bg-white/90 shadow-slate-900/10"
  );

  return (
    <div className={containerClasses}>
      {/* ambient blobs (match login page theme) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className={cx("absolute -left-32 top-10 h-72 w-72 rounded-full blur-3xl", isDark ? "bg-indigo-500/30" : "bg-sky-300/50")} aria-hidden />
        <div className={cx("absolute -right-24 bottom-0 h-80 w-80 rounded-full blur-3xl", isDark ? "bg-emerald-500/20" : "bg-amber-200/60")} aria-hidden />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-8 pt-8">
          <Link
            href="/play"
            className={cx(
              "flex items-center gap-3 rounded-full px-4 py-2 text-sm font-semibold no-underline transition",
              isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-white text-slate-900 shadow"
            )}
          >
            <span className="text-lg">🚀</span>
            <span className="tracking-[0.2em] uppercase">OpenCraft</span>
          </Link>

          <button
            type="button"
            onClick={toggleTheme}
            className={themeButtonClasses}
            aria-label={isDark ? "Switch to day mode" : "Switch to night mode"}
            aria-pressed={isDark}
            title={isDark ? "Switch to day mode" : "Switch to night mode"}
          >
            <span aria-hidden>{isDark ? "🌞" : "🌙"}</span>
          </button>
        </header>

        {/* Main */}
        <main className="flex-1 px-6 pb-16">
          <div className="mx-auto mt-8 grid w-full max-w-5xl gap-6">
            {/* Profile header card */}
            <section className={cx(cardBase, "p-6 sm:p-8")}>
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-5">
                  {/* Avatar circle (emoji/sticker unlock later) */}
                  <div
                    className={cx(
                      "grid h-20 w-20 place-items-center rounded-2xl text-4xl shadow-lg",
                      isDark ? "bg-white/5" : "bg-slate-100"
                    )}
                    title="Profile sticker (unlocks via gameplay)"
                    aria-label="Profile sticker"
                  >
                    <span aria-hidden className="drop-shadow">{avatarEmoji}</span>
                  </div>

                  <div>
                    <h1 className="text-2xl font-semibold leading-tight">{alias}</h1>
                    <p className={cx("mt-1 text-sm", isDark ? "text-white/60" : "text-slate-500")}>
                      email hidden
                    </p>
                    <p className={cx("mt-0.5 text-xs uppercase tracking-[0.3em]", isDark ? "text-white/40" : "text-slate-500")}>
                      Player Profile
                    </p>
                  </div>
                </div>

                {/* Quick stats strip */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatPill label="Plays" value={String(stats.totalPlays)} isDark={isDark} />
                  <StatPill label="Best Rank" value={String(stats.bestRank)} isDark={isDark} />
                  <StatPill label="Discoveries" value={String(stats.totalDiscoveries)} isDark={isDark} />
                  <StatPill label="Streak" value={`${stats.streak} 🔥`} isDark={isDark} />
                </div>
              </div>
            </section>

            {/* Awards */}
            <section className={cx(cardBase, "p-6 sm:p-8")}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Awards</h2>
                <span className={cx("text-xs uppercase tracking-[0.3em]", isDark ? "text-white/40" : "text-slate-500")}>
                  Earned in play
                </span>
              </div>

              {awards.length === 0 ? (
                <EmptyState
                  isDark={isDark}
                  emoji="🏆"
                  title="No awards yet"
                  subtitle="Unlock awards by discovering new recipes and climbing the daily ranks."
                />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {awards.map((a) => (
                    <div
                      key={a.id}
                      className={cx(
                        "flex items-center gap-3 rounded-2xl border p-3",
                        isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"
                      )}
                      title={a.hint || a.title}
                    >
                      <div className="grid h-10 w-10 place-items-center rounded-xl text-xl">
                        <span aria-hidden>{a.emoji ?? "✨"}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{a.title}</p>
                        {a.hint && (
                          <p className={cx("truncate text-xs", isDark ? "text-white/50" : "text-slate-500")}>{a.hint}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Game History */}
            <section className={cx(cardBase, "p-6 sm:p-8")}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Game History</h2>
                <span className={cx("text-xs uppercase tracking-[0.3em]", isDark ? "text-white/40" : "text-slate-500")}>
                  Recent runs
                </span>
              </div>

              {history.length === 0 ? (
                <EmptyState
                  isDark={isDark}
                  emoji="🗓️"
                  title="No games recorded"
                  subtitle="Your recent plays will appear here once you start a daily run."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className={cx("w-full text-sm", isDark ? "text-slate-100" : "text-slate-900")}>
                    <thead className={cx(isDark ? "text-white/60" : "text-slate-600")}>
                      <tr className="text-left">
                        <Th isDark={isDark}>Date</Th>
                        <Th isDark={isDark}>Target</Th>
                        <Th isDark={isDark}>Rank</Th>
                        <Th isDark={isDark}>Moves</Th>
                        <Th isDark={isDark}>Result</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((row) => (
                        <tr key={row.id} className={cx("border-t", isDark ? "border-white/10" : "border-slate-200")}>
                          <Td isDark={isDark}>{row.date}</Td>
                          <Td isDark={isDark}>{row.target}</Td>
                          <Td isDark={isDark}>{row.rank ?? "-"}</Td>
                          <Td isDark={isDark}>{row.moves ?? "-"}</Td>
                          <Td isDark={isDark}>
                            <span
                              className={cx(
                                "rounded-full px-2 py-0.5 text-xs font-semibold",
                                row.result === "Win"
                                  ? isDark
                                    ? "bg-emerald-400/15 text-emerald-300"
                                    : "bg-emerald-100 text-emerald-700"
                                  : isDark
                                  ? "bg-rose-400/15 text-rose-300"
                                  : "bg-rose-100 text-rose-700"
                              )}
                            >
                              {row.result ?? "-"}
                            </span>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </main>

        <footer className="px-8 pb-6 text-center text-xs uppercase tracking-[0.3em]">
          <span className={isDark ? "text-white/40" : "text-slate-500"}>Imagine. Combine. Discover.</span>
        </footer>
      </div>
    </div>
  );
}

/* ---------- tiny UI helpers (keep in-file) ---------- */

function StatPill({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <div
      className={cx(
        "rounded-2xl px-4 py-3 text-center",
        isDark ? "bg-white/5 text-white" : "bg-slate-50 text-slate-900",
        "border",
        isDark ? "border-white/10" : "border-slate-200"
      )}
    >
      <div className={cx("text-xs uppercase tracking-[0.3em]", isDark ? "text-white/50" : "text-slate-500")}>{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}

function EmptyState({ isDark, emoji, title, subtitle }: { isDark: boolean; emoji: string; title: string; subtitle: string }) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center rounded-2xl border px-4 py-10 text-center",
        isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"
      )}
    >
      <div className="text-3xl drop-shadow" aria-hidden>
        {emoji}
      </div>
      <p className="mt-2 text-base font-semibold">{title}</p>
      <p className={cx("mt-1 text-sm", isDark ? "text-white/60" : "text-slate-500")}>{subtitle}</p>
    </div>
  );
}

function Th({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return <th className={cx("pb-2 pr-4 text-xs font-semibold uppercase tracking-[0.2em]", isDark ? "text-white/60" : "text-slate-500")}>{children}</th>;
}
function Td({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return <td className={cx("py-2 pr-4 align-middle", isDark ? "text-white/85" : "text-slate-800")}>{children}</td>;
}
