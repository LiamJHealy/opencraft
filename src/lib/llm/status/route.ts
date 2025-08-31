export async function GET() {
  try {
    const url = process.env.OLLAMA_URL ?? "http://localhost:11434";
    const res = await fetch(`${url}/api/tags`, { cache: "no-store" });
    const tags = await res.json();
    return Response.json({
      provider: process.env.MODEL_PROVIDER,
      model: process.env.OLLAMA_MODEL,
      tags,
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || "unreachable" }, { status: 500 });
  }
}
