import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";
import { ensureElementEmoji } from "@/lib/emoji/select";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const raw = typeof body?.name === "string" ? body.name : "";
    const name = normalizeName(raw);
    if (!name) return Response.json({ error: "name required" }, { status: 400 });

    const word = await prisma.word.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    const emoji = await ensureElementEmoji(word.name);
    return Response.json({ name: word.name, emoji }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
