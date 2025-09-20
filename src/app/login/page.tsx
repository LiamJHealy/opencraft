// src/app/login/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/providers/SessionProvider";
import { useTheme } from "@/components/providers/ThemeProvider";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function LoginPage() {
  const { isDark, toggleTheme } = useTheme();
  const { user, setUser } = useSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [alias, setAlias] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace("/play");
    }
  }, [router, user]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMsg(null);

    const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body = mode === "login" ? { email, password } : { email, alias, password };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error || "Something went wrong");
        return;
      }
      setUser(json.user ?? null);
      router.push("/play");
    } catch (error) {
      console.error(error);
      setMsg("We could not reach the server. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function forgot() {
    if (!email) {
      setMsg("Enter your email first");
      return;
    }
    try {
      await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setMsg("If the email exists, we've sent your password.");
    } catch (error) {
      console.error(error);
      setMsg("Unable to send reset email right now.");
    }
  }

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
  const cardClasses = cx(
    "w-full max-w-lg rounded-3xl border p-10 shadow-2xl backdrop-blur",
    isDark
      ? "border-white/10 bg-slate-900/70 shadow-slate-950/40"
      : "border-slate-900/10 bg-white/90 shadow-slate-900/10"
  );
  const inputClasses = cx(
    "w-full rounded-2xl border px-4 py-3 text-base transition focus:outline-none focus:ring-2 focus:ring-offset-2",
    isDark
      ? "border-white/15 bg-slate-950/60 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:ring-indigo-400 focus:ring-offset-slate-950"
      : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-300 focus:ring-offset-white"
  );
  const primaryButtonClasses = cx(
    "inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-base font-semibold transition",
    submitting ? "cursor-not-allowed opacity-60" : "hover:-translate-y-0.5 hover:shadow-lg",
    isDark
      ? "bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 text-slate-950 shadow-indigo-500/30"
      : "bg-slate-900 text-white shadow-slate-900/15"
  );
  const tabClasses = (target: "login" | "register") =>
    cx(
      "flex-1 rounded-full px-4 py-2 text-sm font-semibold transition",
      mode === target
        ? isDark
          ? "bg-white text-slate-900 shadow"
          : "bg-slate-900 text-white shadow"
        : isDark
        ? "text-white/70 hover:text-white"
        : "text-slate-500 hover:text-slate-900"
    );

  return (
    <div className={containerClasses}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className={cx(
            "absolute -left-32 top-10 h-72 w-72 rounded-full blur-3xl",
            isDark ? "bg-indigo-500/30" : "bg-sky-300/50"
          )}
          aria-hidden
        />
        <div
          className={cx(
            "absolute -right-24 bottom-0 h-80 w-80 rounded-full blur-3xl",
            isDark ? "bg-emerald-500/20" : "bg-amber-200/60"
          )}
          aria-hidden
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
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

        <main className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className={cardClasses}>
            <div className="mb-6 text-center">
              <p
                className={cx(
                  "text-sm uppercase tracking-[0.4em]",
                  isDark ? "text-white/60" : "text-slate-500"
                )}
              >
                {mode === "login" ? "Welcome back" : "Create your spellbook"}
              </p>
              <h1 className="mt-2 text-3xl font-semibold">Let's craft something new</h1>
              <p className={cx("mt-3 text-sm", isDark ? "text-white/60" : "text-slate-500")}
              >
                Choose your path below and join the daily race.
              </p>
            </div>

            <div className={cx(
              "mb-6 flex items-center gap-1 rounded-full border p-1",
              isDark ? "border-white/15 bg-white/5" : "border-slate-900/10 bg-slate-100"
            )}>
              <button type="button" className={tabClasses("login")} onClick={() => setMode("login")}>Log in</button>
              <button type="button" className={tabClasses("register")} onClick={() => setMode("register")}>
                Register
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className={cx("mb-1 block text-sm font-semibold", isDark ? "text-white/70" : "text-slate-600")}>Email</label>
                <input
                  className={inputClasses}
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              {mode === "register" && (
                <div>
                  <label className={cx("mb-1 block text-sm font-semibold", isDark ? "text-white/70" : "text-slate-600")}
                  >Alias (leaderboard name)</label>
                  <input
                    className={inputClasses}
                    required
                    value={alias}
                    onChange={(event) => setAlias(event.target.value)}
                  />
                </div>
              )}

              <div>
                <label className={cx("mb-1 block text-sm font-semibold", isDark ? "text-white/70" : "text-slate-600")}>Password</label>
                <input
                  className={inputClasses}
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              {msg && (
                <div
                  className={cx(
                    "rounded-2xl px-4 py-3 text-sm",
                    isDark ? "bg-rose-500/10 text-rose-200" : "bg-rose-100 text-rose-700"
                  )}
                >
                  {msg}
                </div>
              )}

              <button type="submit" className={primaryButtonClasses} disabled={submitting}>
                <span>{mode === "login" ? "Log in" : "Create account"}</span>
                <span aria-hidden>{mode === "login" ? "➡️" : "✨"}</span>
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className={cx(
                    "font-semibold underline-offset-4 transition hover:underline",
                    isDark ? "text-sky-300" : "text-slate-700"
                  )}
                  onClick={() => setMode(mode === "login" ? "register" : "login")}
                >
                  {mode === "login" ? "Need an account?" : "I have an account"}
                </button>
                {mode === "login" && (
                  <button
                    type="button"
                    className={cx(
                      "font-semibold underline-offset-4 transition hover:underline",
                      isDark ? "text-emerald-300" : "text-emerald-600"
                    )}
                    onClick={forgot}
                  >
                    Forgot password
                  </button>
                )}
              </div>
            </form>
          </div>
        </main>

        <footer className="px-8 pb-6 text-center text-xs uppercase tracking-[0.3em]">
          <span className={isDark ? "text-white/40" : "text-slate-500"}>
            Imagine. Combine. Discover.
          </span>
        </footer>
      </div>
    </div>
  );
}


