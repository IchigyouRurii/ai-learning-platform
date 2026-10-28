import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Course, User } from "@/shared/contracts";
import { createDiscussionRepository } from "@/shared/database/discussion-repository";
import { createNeonRepository } from "@/shared/database/neon-repository";
import { createSeedState } from "@/shared/database/seed";
import { createTestPostgres } from "./helpers/postgres";

let postgres: Awaited<ReturnType<typeof createTestPostgres>>;
let platform: ReturnType<typeof createNeonRepository>;
let discussions: ReturnType<typeof createDiscussionRepository>;

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
  discussions = createDiscussionRepository(postgres.pool);
}, 30000);

beforeEach(async () => {
  await postgres.database.exec(
    `truncate table "user", courses, course_revisions, enrollments,
      discussion_questions, discussion_replies cascade`,
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

describe("course-scoped discussion repository", () => {
  it("lets enrolled students see and answer each other's questions, but keeps outsiders out", async () => {
    const question = await discussions.insertQuestion(student, {
      courseId: "course-1",
      courseVersion: 1,
      message: "How do I describe a requirement clearly?",
    });
    expect(question).not.toBeNull();
    expect(question?.author).toMatchObject({
      id: student.id,
      name: student.name,
      role: "student",
    });

    const peerPage = await discussions.listThreads(peer, "course-1", {
      limit: 20,
    });
    expect(peerPage?.items).toHaveLength(1);

    const teacherPage = await discussions.listThreads(teacher, "course-1", {
      limit: 20,
    });
    expect(teacherPage?.items).toHaveLength(1);

    expect(
      await discussions.listThreads(outsider, "course-1", { limit: 20 }),
    ).toBeNull();
    expect(
      await discussions.listThreads(otherTeacher, "course-1", { limit: 20 }),
    ).toBeNull();
    expect(await discussions.getThread(outsider, question!.id)).toBeNull();
  });

  it("accepts peer and teacher replies and returns authors in time order", async () => {
    const question = await discussions.insertQuestion(student, {
      courseId: "course-1",
      courseVersion: 1,
      message: "What makes a good acceptance criterion?",
    });
    const peerReply = await discussions.insertReply(
      peer,
      question!.id,
      "It should be observable and testable.",
    );
    expect(peerReply?.author).toMatchObject({
      id: peer.id,
      role: "student",
    });
    const teacherReply = await discussions.insertReply(
      teacher,
      question!.id,
      "Start with the user-visible result.",
    );
    expect(teacherReply?.author).toMatchObject({
      id: teacher.id,
      role: "teacher",
    });

    expect(
      await discussions.insertReply(
        outsider,
        question!.id,
        "I should not see this.",
      ),
    ).toBeNull();
    expect(
      await discussions.insertReply(
        otherTeacher,
        question!.id,
        "I do not own this course.",
      ),
    ).toBeNull();

    const thread = await discussions.getThread(student, question!.id);
    expect(thread?.replies.map((reply) => reply.author.id)).toEqual([
      peer.id,
      teacher.id,
    ]);
  });

  it("lets only the asker or course teacher resolve a question", async () => {
    const question = await discussions.insertQuestion(student, {
      courseId: "course-1",
      courseVersion: 1,
      message: "Can I mark this resolved?",
    });

    expect(await discussions.resolve(peer, question!.id)).toBeNull();
    expect(await discussions.resolve(outsider, question!.id)).toBeNull();
    expect(await discussions.resolve(otherTeacher, question!.id)).toBeNull();

    const resolvedByAsker = await discussions.resolve(student, question!.id);
    expect(resolvedByAsker?.status).toBe("resolved");
    expect((await discussions.resolve(student, question!.id))?.status).toBe(
      "resolved",
    );

    const second = await discussions.insertQuestion(student, {
      courseId: "course-1",
      courseVersion: 1,
      message: "Teacher can resolve this one.",
    });
    expect((await discussions.resolve(teacher, second!.id))?.status).toBe(
      "resolved",
    );
  });

  it("rejects questions from outsiders, stale versions, and unknown lessons", async () => {
    expect(
      await discussions.insertQuestion(outsider, {
        courseId: "course-1",
        courseVersion: 1,
        message: "Outsider question",
      }),
    ).toBeNull();
    expect(
      await discussions.insertQuestion(peer, {
        courseId: "course-1",
        courseVersion: 2,
        message: "Stale version",
      }),
    ).toBeNull();
    expect(
      await discussions.insertQuestion(peer, {
        courseId: "course-1",
        courseVersion: 1,
        lessonId: "missing-lesson",
        message: "Unknown lesson",
      }),
    ).toBeNull();

    const lessonId = draft().lessons[0].id;
    expect(
      await discussions.insertQuestion(peer, {
        courseId: "course-1",
        courseVersion: 1,
        lessonId,
        message: "Question about this lesson",
      }),
    ).not.toBeNull();
  });

  it("paginates questions and lets a teacher filter by student", async () => {
    await discussions.insertQuestion(student, {
      courseId: "course-1",
      courseVersion: 1,
      message: "Question from student one",
    });
    await discussions.insertQuestion(peer, {
      courseId: "course-1",
      courseVersion: 1,
      message: "Question from student two",
    });

    const first = await discussions.listThreads(teacher, "course-1", {
      limit: 1,
    });
    expect(first?.items).toHaveLength(1);
    expect(first?.nextCursor).toBeTruthy();
    const second = await discussions.listThreads(teacher, "course-1", {
      limit: 1,
      cursor: first!.nextCursor!,
    });
    expect(second?.items).toHaveLength(1);
    expect(second?.nextCursor).toBeNull();

    const filtered = await discussions.listThreads(
      teacher,
      "course-1",
      { limit: 20 },
      peer.id,
    );
    expect(filtered?.items).toHaveLength(1);
    expect(filtered?.items[0].author.id).toBe(peer.id);
  });

  it("requires an active learning grant, not a bare enrollment row", async () => {
    await postgres.pool.query(
      "update enrollments set direct_access = false where course_id = 'course-1' and student_id = $1",
      [peer.id],
    );
    expect(
      await discussions.listThreads(peer, "course-1", { limit: 20 }),
    ).toBeNull();
    expect(
      await discussions.insertQuestion(peer, {
        courseId: "course-1",
        courseVersion: 1,
        message: "Should not be allowed without a real grant",
      }),
    ).toBeNull();

    await postgres.pool.query(
      "insert into classrooms (id, teacher_id, name, description, course_id) values ('class-1', $1, 'Class', '', 'course-1')",
      [teacher.id],
    );
    await postgres.pool.query(
      "insert into classroom_members (class_id, student_id) values ('class-1', $1)",
      [peer.id],
    );
    await postgres.pool.query(
      "insert into course_assignments (id, class_id, course_id, course_version) values ('assignment-1', 'class-1', 'course-1', 1)",
    );

    expect(
      await discussions.listThreads(peer, "course-1", { limit: 20 }),
    ).not.toBeNull();
    expect(
      await discussions.insertQuestion(peer, {
        courseId: "course-1",
        courseVersion: 1,
        message: "Allowed through an active class assignment",
      }),
    ).not.toBeNull();

    await postgres.pool.query(
      "update course_assignments set revoked_at = now() where id = 'assignment-1'",
    );
    expect(
      await discussions.listThreads(peer, "course-1", { limit: 20 }),
    ).toBeNull();
  });
});
