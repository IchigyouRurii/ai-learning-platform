import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Course, User } from "@/shared/contracts";
import { createAnnotationRepository } from "@/shared/database/annotation-repository";
import { createNeonRepository } from "@/shared/database/neon-repository";
import { createSeedState } from "@/shared/database/seed";
import { createTestPostgres } from "./helpers/postgres";

let postgres: Awaited<ReturnType<typeof createTestPostgres>>;
let platform: ReturnType<typeof createNeonRepository>;
let annotations: ReturnType<typeof createAnnotationRepository>;

const teacher: User = { id: "teacher-1", name: "Teacher One", role: "teacher" };
const otherTeacher: User = {
  id: "teacher-2",
  name: "Teacher Two",
  role: "teacher",
};
const student: User = { id: "student-1", name: "Student One", role: "student" };
const peer: User = { id: "student-2", name: "Student Two", role: "student" };
const outsider: User = {
  id: "student-3",
  name: "Student Three",
  role: "student",
};

const draft = (): Course => ({
  ...createSeedState().courses[0],
  id: "course-1",
  ownerId: teacher.id,
  status: "draft",
});

const lessonId = draft().lessons[0].id;
const blockId = draft().lessons[0].blocks[0].id;

async function seedCourse() {
  await platform.insertCourse(draft());
  await platform.publishCourse("course-1", teacher.id);
  await platform.enroll("course-1", student.id);
  await platform.enroll("course-1", peer.id);
}

beforeAll(async () => {
  postgres = await createTestPostgres();
  await postgres.database.exec(
    'create table "user" (id text primary key, name text, role text)',
  );
  const migrations = new URL("../database/migrations/", import.meta.url);
  for (const name of (await readdir(migrations))
    .filter((name) => name.endsWith(".sql"))
    .sort())
    await postgres.database.exec(
      await readFile(new URL(name, migrations), "utf8"),
    );
  platform = createNeonRepository(postgres.pool);
  annotations = createAnnotationRepository(postgres.pool);
}, 30000);

beforeEach(async () => {
  await postgres.database.exec(
    `truncate table "user", courses, course_revisions, enrollments,
      content_annotations cascade`,
  );
  for (const user of [teacher, otherTeacher, student, peer, outsider])
    await postgres.pool.query(
      'insert into "user" (id, name, role) values ($1, $2, $3)',
      [user.id, user.name, user.role],
    );
  await seedCourse();
});

afterAll(async () => {
  if (postgres) await postgres.database.close();
});

describe("content annotations", () => {
  it("creates a private annotation and lets the student and teacher read it", async () => {
    const annotation = await annotations.create(student, {
      courseId: "course-1",
      courseVersion: 1,
      lessonId,
      blockId,
      quote: "An actionable requirement",
      category: "possible_error",
      message: "Is this statement accurate?",
    });
    expect(annotation).not.toBeNull();
    expect(annotation).toMatchObject({
      student: { id: student.id },
      category: "possible_error",
      status: "open",
      teacherReply: null,
    });
    expect(annotation?.studentSeenAt).not.toBeNull();

    const mine = await annotations.listMine(
      student,
      { courseId: "course-1", courseVersion: 1 },
      { limit: 20 },
    );
    expect(mine?.items).toHaveLength(1);

    const teacherPage = await annotations.listForTeacher(teacher, {
      limit: 20,
    });
    expect(teacherPage?.items).toHaveLength(1);

    expect(
      (await annotations.listForTeacher(otherTeacher, { limit: 20 }))?.items,
    ).toHaveLength(0);
    expect(
      await annotations.listMine(
        outsider,
        { courseId: "course-1", courseVersion: 1 },
        { limit: 20 },
      ),
    ).toBeNull();
  });

  it("rejects a block that is not part of the published version", async () => {
    expect(
      await annotations.create(student, {
        courseId: "course-1",
        courseVersion: 1,
        lessonId,
        blockId: "missing-block",
        category: "question",
        message: "Should not be created",
      }),
    ).toBeNull();
    expect(
      await annotations.create(outsider, {
        courseId: "course-1",
        courseVersion: 1,
        lessonId,
        blockId,
        category: "question",
        message: "Outsider cannot create",
      }),
    ).toBeNull();
  });

  it("lets the teacher reply or resolve, and marks student unread on teacher action", async () => {
    const annotation = await annotations.create(student, {
      courseId: "course-1",
      courseVersion: 1,
      lessonId,
      blockId,
      category: "unclear",
      message: "Could you explain this?",
    });

    expect(
      await annotations.reply(otherTeacher, annotation!.id, "No access"),
    ).toBeNull();

    const replied = await annotations.reply(
      teacher,
      annotation!.id,
      "The statement means the feature is testable.",
    );
    expect(replied).toMatchObject({
      status: "replied",
      teacherReply: "The statement means the feature is testable.",
    });
    expect(replied?.studentSeenAt).toBeNull();

    const resolved = await annotations.resolve(teacher, annotation!.id);
    expect(resolved).toMatchObject({
      status: "resolved",
      teacherReply: "The statement means the feature is testable.",
    });
    expect(resolved?.studentSeenAt).toBeNull();

    const second = await annotations.create(student, {
      courseId: "course-1",
      courseVersion: 1,
      lessonId,
      blockId,
      category: "outdated",
      message: "This may be outdated.",
    });
    const resolvedWithoutReply = await annotations.resolve(teacher, second!.id);
    expect(resolvedWithoutReply).toMatchObject({
      status: "resolved",
      teacherReply: null,
    });
  });

  it("marks a teacher reply as seen only for the annotation author", async () => {
    const annotation = await annotations.create(student, {
      courseId: "course-1",
      courseVersion: 1,
      lessonId,
      blockId,
      category: "question",
      message: "Can I mark this seen?",
    });

    expect(await annotations.markSeen(student, annotation!.id)).toBe(false);
    await annotations.reply(teacher, annotation!.id, "Yes.");
    expect(await annotations.markSeen(peer, annotation!.id)).toBe(false);
    expect(await annotations.markSeen(student, annotation!.id)).toBe(true);
    expect(await annotations.markSeen(student, annotation!.id)).toBe(true);
  });
});
