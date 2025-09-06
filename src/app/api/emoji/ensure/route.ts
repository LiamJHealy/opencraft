import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";
import { ensureElementEmoji } from "@/lib/emoji/select";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const raw = typeof body?.name === "string" ? body.name : "";
    const name = normalizeName(raw);
    if (!name) return Response.json({ error: "name required" }, { status: 400 });

    // element must exist already; if not, create it empty
    const el = await prisma.element.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    const emoji = await ensureElementEmoji(el.name);
    return Response.json({ name: el.name, emoji }, { status: 200 });
  } catch (e: any) {
    return Response.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
