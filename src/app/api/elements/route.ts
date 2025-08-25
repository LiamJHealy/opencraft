import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";

export async function GET() {
  const elements = await prisma.element.findMany({
    orderBy: { id: "asc" },
  });
  return Response.json(elements);
}

export async function POST(request: Request) {
  try {
    const { name } = (await request.json()) as { name?: string };

    if (!name || !name.trim()) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    const canonical = normalizeName(name);

    const element = await prisma.element.upsert({
      where: { name: canonical },
      update: {},
      create: { name: canonical },
    });

    return Response.json(element, { status: 201 });
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
}
