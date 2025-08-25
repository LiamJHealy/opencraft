async function fetchElements() {
  const res = await fetch("http://localhost:3000/api/elements", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch elements");
  return (await res.json()) as { id: number; name: string }[];
}

export default async function Home() {
  const elements = await fetchElements();
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">Liam’s OpenCraft Reboot</h1>
      <p className="mt-2">Phase 1: SQLite + Prisma persistence is live.</p>

      <h2 className="mt-6 text-xl font-semibold">Elements</h2>
      <ul className="list-disc ml-6">
        {elements.map((e) => (
          <li key={e.id}>{e.name}</li>
        ))}
      </ul>
    </main>
  );
}
