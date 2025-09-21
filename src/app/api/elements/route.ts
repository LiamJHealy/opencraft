import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";

export async function GET() {
  const words = await prisma.word.findMany({
    orderBy: { id: "asc" },
  });
  return Response.json(words);
}

export async function POST(request: Request) {
  try {
    const { name } = (await request.json()) as { name?: string };

    if (!name || !name.trim()) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    const canonical = normalizeName(name);

    const word = await prisma.word.upsert({
      where: { name: canonical },
      update: {},
      create: { name: canonical },
    });

    return Response.json(word, { status: 201 });
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
}
