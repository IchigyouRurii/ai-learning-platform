import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestPostgres } from "./helpers/postgres";
import { shortenIntroductions } from "../scripts/db/lib/shorten-introductions";
let db: Awaited<ReturnType<typeof createTestPostgres>>;
beforeAll(async () => {
  db = await createTestPostgres();
  await db.database
    .exec(`create table courses(id text primary key,owner_id text,draft_content jsonb,draft_revision int,version int,published_version int,updated_at timestamptz);
 create table course_revisions(course_id text,version int,content jsonb,published_at timestamptz default now(),primary key(course_id,version));
 insert into courses values('one','teacher','{"title":"Private draft title","description":"Long original introduction","lessons":[{"id":"private"}]}',2,1,1,now());
 insert into course_revisions(course_id,version,content) values('one',1,'{"title":"Public title","description":"Long public introduction","lessons":[{"id":"published"}]}');
 insert into courses values('two','other','{"description":"Second original"}',1,1,null,now());`);
}, 30000);
afterAll(async () => {
  if (db) await db.database.close();
});
const plan = {
  id: "one",
  ownerId: "teacher",
  draftRevision: 2,
  publishedVersion: 1,
  previous: "Long original introduction",
  publishedPrevious: "Long public introduction",
  introduction: "A concise introduction.",
};
it("rolls back the whole plan if any owner/revision guard fails", async () => {
  await expect(
    shortenIntroductions(db.pool, [
      plan,
      {
        id: "two",
        ownerId: "wrong-owner",
        draftRevision: 1,
        publishedVersion: null,
        previous: "Second original",
        publishedPrevious: null,
        introduction: "Second concise summary.",
      },
    ]),
  ).rejects.toThrow("changed");
  expect(
    (await db.pool.query("select count(*)::int as n from course_revisions"))
      .rows[0].n,
  ).toBe(1);
  expect(
    (await db.pool.query("select draft_revision from courses where id='one'"))
      .rows[0].draft_revision,
  ).toBe(2);
});
it("updates only the introduction, preserving private draft differences and original publication", async () => {
  await shortenIntroductions(db.pool, [plan]);
  const course = (await db.pool.query("select * from courses where id='one'"))
    .rows[0];
  expect(course.draft_content).toEqual({
    title: "Private draft title",
    description: plan.introduction,
    lessons: [{ id: "private" }],
  });
  expect(course.published_version).toBe(2);
  const revisions = (
    await db.pool.query("select * from course_revisions order by version")
  ).rows;
  expect(revisions[0].content.description).toBe("Long public introduction");
  expect(revisions[1].content).toEqual({
    ...revisions[0].content,
    description: plan.introduction,
  });
  await expect(shortenIntroductions(db.pool, [plan])).rejects.toThrow(
    "changed",
  );
});

it("can shorten a draft while keeping the current publication and learning version", async () => {
  await db.pool.query(
    `insert into courses values('three','teacher','{"description":"Draft original"}',1,1,1,now())`,
  );
  await db.pool.query(
    `insert into course_revisions(course_id,version,content) values('three',1,'{"description":"Public original"}')`,
  );
  await shortenIntroductions(db.pool, [
    {
      id: "three",
      ownerId: "teacher",
      draftRevision: 1,
      publishedVersion: 1,
      previous: "Draft original",
      publishedPrevious: "Public original",
      introduction: "A shorter draft.",
      publish: false,
    },
  ]);
  const row = (await db.pool.query("select * from courses where id='three'"))
    .rows[0];
  expect(row.version).toBe(1);
  expect(row.published_version).toBe(1);
  expect(row.draft_content.description).toBe("A shorter draft.");
  expect(
    (
      await db.pool.query(
        "select count(*)::int as n from course_revisions where course_id='three'",
      )
    ).rows[0].n,
  ).toBe(1);
});
