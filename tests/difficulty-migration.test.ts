import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { createTestPostgres } from "./helpers/postgres";
it("defaults old enrollment and progress rows to Beginner while preserving record identities", async () => {
  const db = await createTestPostgres();
  try {
    await db.database
      .exec(`create table enrollments(course_id text,student_id text,primary key(course_id,student_id));
   create table submissions(id text primary key,student_id text,course_id text,course_version int);
   create table lesson_completions(student_id text,course_id text,course_version int,lesson_id text,completed_at timestamptz,primary key(student_id,course_id,course_version,lesson_id));
   insert into enrollments values('c','s');insert into submissions values('answer','s','c',1);
   insert into lesson_completions values('s','c',1,'same-id','2026-10-01');`);
    await db.database.exec(
      await readFile(
        new URL(
          "../database/migrations/202611010001_enrollment_difficulty.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    for (const table of ["enrollments", "submissions", "lesson_completions"])
      expect(
        (await db.pool.query(`select difficulty from ${table}`)).rows[0]
          .difficulty,
      ).toBe("beginner");
    await db.pool.query(
      `insert into lesson_completions(student_id,course_id,course_version,lesson_id,difficulty) values('s','c',1,'same-id','advanced')`,
    );
    expect(
      (await db.pool.query("select count(*)::int as n from lesson_completions"))
        .rows[0].n,
    ).toBe(2);
    await expect(
      db.pool.query("update enrollments set difficulty='invalid'"),
    ).rejects.toThrow();
  } finally {
    await db.database.close();
  }
}, 30000);
