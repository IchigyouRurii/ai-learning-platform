import { requiredEmail, runDatabaseTask } from "./common";

await runDatabaseTask(async (pool) => {
  const email = requiredEmail();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query(
      `update "user" set role = 'teacher', "updatedAt" = now() where lower(email) = $1 and role <> 'admin' returning id`,
      [email],
    );
    if (!result.rows[0]) {
      console.error("没有找到可设置为教师的账号，请先在网页注册该邮箱。");
      await client.query("rollback");
      process.exitCode = 1;
      return;
    }
    await client.query(`delete from "session" where "userId" = $1`, [
      result.rows[0].id,
    ]);
    await client.query("commit");
    console.log("该账号已设为教师，旧会话已失效。请重新登录进入教师端。");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
});
