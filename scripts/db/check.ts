import { runDatabaseTask } from "./common";

await runDatabaseTask(async (pool) => {
  await pool.query("select 1");
  const result = await pool.query(
    `select to_regclass('public.user') is not null and to_regclass('public.courses') is not null as initialized`,
  );
  console.log("Neon / PostgreSQL 连接成功。");
  console.log(
    result.rows[0].initialized
      ? "账号与课程表已存在。"
      : "尚未初始化表，请运行 bash scripts/local.sh db:migrate。",
  );
});
