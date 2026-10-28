import { randomUUID } from "node:crypto";
import { courseDraftSchema } from "../../src/shared/contracts/course";
import { createSeedState } from "../../src/shared/database/seed";
import { requiredEmail, runDatabaseTask } from "./common";

await runDatabaseTask(async (pool) => {
  const email = requiredEmail();
  const replace = process.argv.includes("--replace");
  const owner = await pool.query(
    `select id from "user" where lower(email) = $1 and role = 'teacher'`,
    [email],
  );
  if (!owner.rows[0]) {
    console.error("请先注册账号，并运行 db:promote-teacher 将其设为教师。");
    process.exitCode = 1;
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("begin");
    let removed = 0;
    if (replace) {
      const deleted = await client.query(
        "delete from courses where owner_id = $1 and seed_key is not null",
        [owner.rows[0].id],
      );
      removed = deleted.rowCount ?? 0;
    }
    let count = 0;
    for (const example of createSeedState().courses) {
      const content = courseDraftSchema.parse(example);
      const id = randomUUID();
      const inserted = await client.query(
        `insert into courses (id, owner_id, seed_key, draft_content) values ($1, $2, $3, $4::jsonb) on conflict (owner_id, seed_key) do nothing returning id`,
        [id, owner.rows[0].id, example.id, JSON.stringify(content)],
      );
      if (!inserted.rowCount) continue;
      await client.query(
        "insert into course_revisions (course_id, version, content) values ($1, 1, $2::jsonb)",
        [id, JSON.stringify(content)],
      );
      await client.query(
        "update courses set status = 'published', published_version = 1 where id = $1",
        [id],
      );
      count += 1;
    }
    await client.query("commit");
    console.log(
      `${replace ? `已删除 ${removed} 门旧示例课程；` : ""}已添加 ${count} 门短示例课程。已有示例不会重复添加。`,
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
});
