// src/app/login/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [mode, setMode] = useState<"login"|"register">("login");
  const [email, setEmail] = useState("");
  const [alias, setAlias] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string|null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body = mode === "login" ? { email, password } : { email, alias, password };
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) { setMsg(json.error || "Something went wrong"); return; }
    router.push("/play"); // or wherever your app starts
  }

  async function forgot() {
    if (!email) { setMsg("Enter your email first"); return; }
    await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email })});
    setMsg("If the email exists, we’ve sent your password.");
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold mb-4">OpenCraft {mode === "login" ? "Login" : "Register"}</h1>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input className="w-full rounded border px-3 py-2" type="email" required value={email} onChange={e=>setEmail(e.target.value)} />
        </div>
        {mode === "register" && (
          <div>
            <label className="block text-sm font-medium">Alias (leaderboard name)</label>
            <input className="w-full rounded border px-3 py-2" required value={alias} onChange={e=>setAlias(e.target.value)} />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium">Password</label>
          <input className="w-full rounded border px-3 py-2" type="password" required value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        <div className="flex items-center gap-3">
          <button className="rounded bg-black text-white px-4 py-2">{mode === "login" ? "Login" : "Register"}</button>
          <button type="button" className="text-sm underline" onClick={()=>setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Create account" : "I have an account"}
          </button>
          {mode === "login" && (
            <button type="button" className="ml-auto text-sm underline" onClick={forgot}>Forgot password</button>
          )}
        </div>
      </form>
    </main>
  );
}
