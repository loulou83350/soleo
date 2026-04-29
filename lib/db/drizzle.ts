import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

// ─── Global singleton — prevents connection leak on hot reload ───────────────
// Next.js dev server re-evaluates modules on each file change; without this
// pattern each reload opens a new connection pool, exhausting Supabase limits.

const globalForDb = globalThis as unknown as {
  pgClient: postgres.Sql | undefined;
};

const client =
  globalForDb.pgClient ??
  postgres(process.env.POSTGRES_URL, {
    max: 3,          // cap at 3 connections (safe for Supabase free tier)
    idle_timeout: 20, // release idle connections after 20s
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pgClient = client;
}

export { client };
export const db = drizzle(client, { schema });
