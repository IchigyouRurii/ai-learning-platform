import { Pool } from "pg";

const runtime = globalThis as typeof globalThis & { minicoursePostgres?: Pool };

export function getDatabasePool(): Pool {
  if (runtime.minicoursePostgres) return runtime.minicoursePostgres;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString)
    throw new Error("请先在根目录 .env 填写 DATABASE_URL。");
  try {
    const parsed = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol))
      throw new Error();
  } catch {
    throw new Error(
      "DATABASE_URL 格式不正确，请复制 Neon Connect 中的 PostgreSQL 连接串。",
    );
  }
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });
  pool.on("error", () => console.error("数据库连接暂时不可用。"));
  runtime.minicoursePostgres = pool;
  return pool;
}
