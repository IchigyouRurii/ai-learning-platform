import { Pool } from "pg";

const runtime = globalThis as typeof globalThis & { minicoursePostgres?: Pool };

export function getDatabasePool(): Pool {
  if (runtime.minicoursePostgres) return runtime.minicoursePostgres;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString)
    throw new Error("Set DATABASE_URL in the root .env first.");
  try {
    const parsed = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol))
      throw new Error();
  } catch {
    throw new Error(
      "Invalid DATABASE_URL. Copy the PostgreSQL connection string from Neon Connect.",
    );
  }
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });
  pool.on("error", () =>
    console.error("Database connection is temporarily unavailable."),
  );
  runtime.minicoursePostgres = pool;
  return pool;
}
