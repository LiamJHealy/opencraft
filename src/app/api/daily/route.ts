import { generateDailySet } from "@/lib/daily";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const seed = url.searchParams.get("seed") ?? undefined;
    const daily = await generateDailySet(seed);
    return Response.json(daily, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate daily set" },
      { status: 500 }
    );
  }
}


