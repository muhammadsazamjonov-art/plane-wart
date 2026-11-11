import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

function resolveUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return undefined;
  // On Render, a leftover local .env (localhost DB) must not break the deploy.
  if (process.env.RENDER) {
    try {
      const host = new URL(url).hostname;
      if (host === "127.0.0.1" || host === "localhost") return undefined;
    } catch {
      return undefined;
    }
  }
  return url;
}

const databaseUrl = resolveUrl();

// Local databases (127.0.0.1 / localhost / Render internal hostnames without dots) do not use SSL.
// External managed Postgres (Render external URL, Neon, Supabase, ...) requires SSL.
function needsSsl(url: string) {
  if (process.env.DATABASE_SSL === "false") return false;
  if (process.env.DATABASE_SSL === "true") return true;
  if (/sslmode=require/.test(url)) return true;
  try {
    const host = new URL(url).hostname;
    if (host === "localhost" || host === "127.0.0.1" || !host.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

/** True when a PostgreSQL database is configured. Without it the app uses in-memory storage. */
export const hasDatabase = !!databaseUrl;

export const pool: Pool | null = databaseUrl
  ? globalForDb.__arenaNextJsPostgresqlPool ??
    new Pool({
      connectionString: databaseUrl,
      ssl: needsSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
      max: 10,
    })
  : null;

if (pool && process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db: NodePgDatabase | null = pool ? drizzle(pool) : null;
