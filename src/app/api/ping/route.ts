// src/app/api/ping/route.ts

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: true,
      time: new Date().toISOString(),
    }),
    {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }
  );
}
