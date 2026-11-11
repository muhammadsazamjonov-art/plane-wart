import { db } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { rooms, roomPlayers, scores } from "@/db/schema";
import { and, desc, eq, gt, ne, sql } from "drizzle-orm";

export type ScoreRow = { id: number; name: string; score: number; mode: string; map: string; createdAt: Date };
export type RoomRow = { code: string; map: string; host: string; createdAt: Date };
export type PlayerRow = { pid: string; name: string; state: unknown };

// ---------- in-memory fallback (used when DATABASE_URL is not set) ----------
type Mem = {
  scores: ScoreRow[];
  rooms: Map<string, RoomRow>;
  players: Map<string, { code: string; pid: string; name: string; state: unknown; updatedAt: number }>;
  nextId: number;
};
const g = globalThis as typeof globalThis & { __skyAceMem?: Mem };
const mem: Mem = g.__skyAceMem ?? (g.__skyAceMem = { scores: [], rooms: new Map(), players: new Map(), nextId: 1 });

export const storageKind = db ? "postgres" : "memory";

export async function listScores(limit = 20): Promise<ScoreRow[]> {
  if (!db) return [...mem.scores].sort((a, b) => b.score - a.score).slice(0, limit);
  await ensureSchema();
  return db.select().from(scores).orderBy(desc(scores.score)).limit(limit);
}

export async function addScore(s: { name: string; score: number; mode: string; map: string }) {
  if (!db) {
    mem.scores.push({ id: mem.nextId++, ...s, createdAt: new Date() });
    mem.scores = mem.scores.sort((a, b) => b.score - a.score).slice(0, 200);
    return;
  }
  await ensureSchema();
  await db.insert(scores).values(s);
}

export async function listRooms(limit = 10): Promise<RoomRow[]> {
  if (!db) return [...mem.rooms.values()].sort((a, b) => +b.createdAt - +a.createdAt).slice(0, limit);
  await ensureSchema();
  return db.select().from(rooms).orderBy(desc(rooms.createdAt)).limit(limit);
}

export async function createRoom(map: string, host: string): Promise<string> {
  const code = Math.random().toString(36).slice(2, 7).toUpperCase();
  if (!db) {
    const now = Date.now();
    for (const [k, r] of mem.rooms) if (now - +r.createdAt > 86400000) mem.rooms.delete(k);
    for (const [k, p] of mem.players) if (now - p.updatedAt > 3600000) mem.players.delete(k);
    mem.rooms.set(code, { code, map, host, createdAt: new Date() });
    return code;
  }
  await ensureSchema();
  await db.execute(sql`DELETE FROM room_players WHERE updated_at < now() - interval '1 hour'`);
  await db.execute(sql`DELETE FROM rooms WHERE created_at < now() - interval '1 day'`);
  await db.insert(rooms).values({ code, map, host });
  return code;
}

export async function getRoom(code: string): Promise<RoomRow | null> {
  if (!db) return mem.rooms.get(code) ?? null;
  await ensureSchema();
  const r = await db.select().from(rooms).where(eq(rooms.code, code));
  return r[0] ?? null;
}

/** Upsert my state and return the other active players in the room. */
export async function syncRoom(code: string, pid: string, name: string, state: unknown): Promise<PlayerRow[]> {
  if (!db) {
    const now = Date.now();
    mem.players.set(code + "|" + pid, { code, pid, name, state, updatedAt: now });
    const out: PlayerRow[] = [];
    for (const p of mem.players.values()) if (p.code === code && p.pid !== pid && now - p.updatedAt < 5000) out.push({ pid: p.pid, name: p.name, state: p.state });
    return out;
  }
  await ensureSchema();
  await db
    .insert(roomPlayers)
    .values({ code, pid, name, state: state ?? {} })
    .onConflictDoUpdate({ target: [roomPlayers.code, roomPlayers.pid], set: { state: state ?? {}, name, updatedAt: sql`now()` } });
  return db
    .select({ pid: roomPlayers.pid, name: roomPlayers.name, state: roomPlayers.state })
    .from(roomPlayers)
    .where(and(eq(roomPlayers.code, code), ne(roomPlayers.pid, pid), gt(roomPlayers.updatedAt, sql`now() - interval '5 seconds'`)));
}

export async function healthCheck(): Promise<boolean> {
  if (!db) return true;
  await ensureSchema();
  await db.execute(sql`select 1`);
  return true;
}
