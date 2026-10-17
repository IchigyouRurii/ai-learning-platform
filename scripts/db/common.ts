import { createRequire } from "node:module";
import { getDatabasePool } from "../../src/shared/database/pool";

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
const { loadEnvConfig } = nextRequire("@next/env") as {
  loadEnvConfig: (directory: string, development?: boolean) => unknown;
};

export async function runDatabaseTask(
  task: (pool: ReturnType<typeof getDatabasePool>) => Promise<void>,
) {
  loadEnvConfig(process.cwd(), true);
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "请先在项目根目录唯一的 .env 中填写 DATABASE_URL，再运行此命令。",
    );
    process.exitCode = 1;
    return;
  }
  let pool: ReturnType<typeof getDatabasePool> | undefined;
  try {
    pool = getDatabasePool();
    await task(pool);
  } catch (error) {
    const code =
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string" &&
      /^[A-Z0-9_]+$/.test(error.code)
        ? `（${error.code}）`
        : "";
    console.error(
      `数据库操作失败${code}。请检查 .env、网络和数据库初始化状态；连接串不会打印到终端。`,
    );
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
  }
}

export function requiredEmail() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("请在命令后填写已注册账号的邮箱。");
  return email;
}
