import { addScore, listScores } from "@/db/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await listScores(20));
  } catch {
    return Response.json([]);
  }
}

export async function POST(req: Request) {
  const b = await req.json();
  const name = String(b.name || "Pilot").slice(0, 16);
  const score = Math.max(0, Math.min(1e7, Number(b.score) | 0));
  await addScore({ name, score, mode: String(b.mode || "").slice(0, 20), map: String(b.map || "").slice(0, 30) });
  return Response.json({ ok: true });
}
