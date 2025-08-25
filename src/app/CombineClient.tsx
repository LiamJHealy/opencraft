"use client";

import { useState } from "react";

export default function CombineClient() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [out, setOut] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function onCombine(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setOut(null);
    try {
      const res = await fetch("/api/combine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ left, right }),
      });
      const data = await res.json();
      setOut(data);
    } catch (err: any) {
      setOut({ error: err?.message || "failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-3">
      <form onSubmit={onCombine} className="flex gap-2">
        <input
          className="border rounded px-3 py-2"
          placeholder="left"
          value={left}
          onChange={(e) => setLeft(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="right"
          value={right}
          onChange={(e) => setRight(e.target.value)}
        />
        <button
          className="border rounded px-3 py-2"
          disabled={busy}
        >
          {busy ? "Combining..." : "Combine"}
        </button>
      </form>

      {out && (
        <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
          {JSON.stringify(out, null, 2)}
        </pre>
      )}
    </div>
  );
}
