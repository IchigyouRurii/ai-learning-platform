import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getMigrations } from "better-auth/db/migration";
import { createAuth } from "../../src/modules/platform/server/auth-config";
import { runDatabaseTask } from "./common";

await runDatabaseTask(async (pool) => {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock(726522945332)");
    const auth = createAuth(pool);
    const authMigrations = await getMigrations(auth.options);
    await authMigrations.runMigrations();
    await client.query(
      "create table if not exists minicourse_migrations (name text primary key, checksum text not null, applied_at timestamptz not null default now())",
    );
    const directory = join(process.cwd(), "database", "migrations");
    for (const name of (await readdir(directory))
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      const source = await readFile(join(directory, name), "utf8");
      // Hash the LF-normalized content so Windows (CRLF) and POSIX checkouts
      // agree on whether an applied migration has really changed.
      const normalized = source.replace(/\r\n/g, "\n");
      const checksum = createHash("sha256").update(normalized).digest("hex");
      const rawChecksum = createHash("sha256").update(source).digest("hex");
      const previous = await client.query(
        "select checksum from minicourse_migrations where name = $1",
        [name],
      );
      if (previous.rows[0]) {
        if (previous.rows[0].checksum !== checksum) {
          if (previous.rows[0].checksum === rawChecksum) {
            // The migration was applied from a CRLF checkout. Store the
            // normalized checksum without re-running the SQL.
            await client.query(
              "update minicourse_migrations set checksum = $1 where name = $2",
              [checksum, name],
            );
            console.log(`已统一 ${name} 的换行校验和。`);
            continue;
          }
          throw new Error(
            `已应用的迁移发生变化：${name}。请新增迁移文件，不要修改历史迁移。`,
          );
        }
        continue;
      }
      await client.query("begin");
      try {
        await client.query(source);
        await client.query(
          "insert into minicourse_migrations (name, checksum) values ($1, $2)",
          [name, checksum],
        );
        await client.query("commit");
        console.log(`已应用 ${name}`);
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
    console.log(
      "账号、会话与课程数据库初始化完成。可重复运行，已应用迁移会跳过。",
    );
  } finally {
    await client.query("select pg_advisory_unlock(726522945332)");
    client.release();
  }
});
