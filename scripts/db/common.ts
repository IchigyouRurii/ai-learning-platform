import { createRequire } from "node:module";
import { databaseFailureDiagnostic } from "../../src/shared/database/diagnostics";
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
    const diagnostic = databaseFailureDiagnostic(error);
    console.error(`Database operation failed [${diagnostic.code}].`);
    console.error(diagnostic.hint);
    if (process.env.DEBUG_DB === "1") {
      // Error.message can contain SQL, credentials or private data. Do not print it.
      const type =
        error instanceof Error && /^[A-Za-z][A-Za-z0-9]*$/.test(error.name)
          ? error.name
          : "Error";
      console.error(`Error type: ${type}; upstream message withheld.`);
    }
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
