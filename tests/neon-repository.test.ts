import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Course, Submission, User } from "@/shared/contracts";
import { createNeonRepository } from "@/shared/database/neon-repository";
import { createSeedState } from "@/shared/database/seed";
import { createTestPostgres } from "./helpers/postgres";

let postgres: Awaited<ReturnType<typeof createTestPostgres>>;
let repository: ReturnType<typeof createNeonRepository>;
const teacher: User = { id: "teacher-1", role: "teacher", name: "教师" };
const student: User = { id: "student-1", role: "student", name: "学习者" };
const otherStudent: User = { ...student, id: "student-2" };
const draft = (): Course => ({
  ...createSeedState().courses[0],
  id: "course-1",
  ownerId: teacher.id,
  status: "draft",
});
const submission = (): Submission => ({
  id: randomUUID(),
  courseId: "course-1",
  courseVersion: 1,
  activityId: "ai-coding-r1",
  studentId: student.id,
  answer: "需求应包括使用者、任务以及验收条件。",
  aiFeedback: "请补充一个例子。",
  createdAt: new Date().toISOString(),
});

beforeAll(async () => {
  postgres = await createTestPostgres();
  await postgres.database.exec(
    'create table "user" (id text primary key, name text, role text)',
  );
  for (const name of [
    "202610170001_neon.sql",
    "202610220001_course_editing.sql",
    "202610250001_ai_history.sql",
    "202610270001_administration.sql",
    "202610270002_classrooms.sql",
    "202610270003_admin_classrooms.sql",
    "202610290001_lesson_completions.sql",
    "202610290002_quiz_scores.sql",
  ])
    await postgres.database.exec(
      await readFile(
        new URL(`../database/migrations/${name}`, import.meta.url),
        "utf8",
      ),
    );
  repository = createNeonRepository(postgres.pool);
}, 30000);
beforeEach(async () => {
  await postgres.database.exec(
    'truncate table "user", courses, course_revisions, enrollments, submissions, teacher_feedback, learning_profiles, generation_jobs, lesson_completions cascade',
  );
  for (const user of [teacher, student, otherStudent])
    await postgres.pool.query(
      'insert into "user" (id, name, role) values ($1, $2, $3)',
      [user.id, user.name, user.role],
    );
});
afterAll(async () => {
  if (postgres) await postgres.database.close();
});

describe("Neon SQL repository", () => {
  it("keeps drafts private and publishes an immutable snapshot atomically", async () => {
    await repository.insertCourse(draft());
    expect((await repository.getWorkspace(student)).courses).toHaveLength(0);
    await expect(
      repository.publishCourse("course-1", "other-teacher"),
    ).rejects.toThrow(/access denied/i);
    await repository.publishCourse("course-1", teacher.id);
    await repository.publishCourse("course-1", teacher.id);
    expect(
      (await postgres.pool.query("select * from course_revisions")).rows,
    ).toHaveLength(1);
    await postgres.pool.query(
      "update courses set draft_content = jsonb_set(draft_content, '{title}', '\"Changed draft\"') where id = 'course-1'",
    );
    expect((await repository.getWorkspace(student)).courses[0].title).toBe(
      draft().title,
    );
    expect(
      (await repository.getWorkspace({ ...teacher, id: "other-teacher" }))
        .courses,
    ).toHaveLength(0);
  });
  it("joins idempotently and rejects submissions without enrollment, wrong versions or unknown activities", async () => {
    await repository.insertCourse(draft());
    await repository.publishCourse("course-1", teacher.id);
    await expect(repository.insertSubmission(submission())).rejects.toThrow(
      "enrollment",
    );
    await repository.enroll("course-1", student.id);
    await repository.enroll("course-1", student.id);
    expect((await repository.getWorkspace(student)).enrollments).toHaveLength(
      1,
    );
    await expect(
      repository.insertSubmission({ ...submission(), courseVersion: 2 }),
    ).rejects.toThrow("course, activity, or enrollment");
    await expect(
      repository.insertSubmission({ ...submission(), activityId: "forged" }),
    ).rejects.toThrow("course, activity, or enrollment");
    await repository.insertSubmission(submission());
    expect((await repository.getWorkspace(student)).submissions).toHaveLength(
      1,
    );
    expect(
      (await repository.getWorkspace(otherStudent)).submissions,
    ).toHaveLength(0);
  });
  it("records lesson completion idempotently and scopes it to enrolled students", async () => {
    await repository.insertCourse(draft());
    await repository.publishCourse("course-1", teacher.id);
    await repository.enroll("course-1", student.id);
    const lessonId = draft().lessons[0].id;

    await repository.completeLesson("course-1", 1, lessonId, student.id);
    await repository.completeLesson("course-1", 1, lessonId, student.id);
    expect(
      (await repository.getWorkspace(student)).lessonCompletions ?? [],
    ).toHaveLength(1);

    await repository.completeLesson("course-1", 1, lessonId, otherStudent.id, false);
    expect((await repository.getWorkspace(student)).lessonCompletions).toHaveLength(1);
    await repository.completeLesson("course-1", 1, lessonId, student.id, false);
    await repository.completeLesson("course-1", 1, lessonId, student.id, false);
    expect((await repository.getWorkspace(student)).lessonCompletions).toHaveLength(0);
    await repository.completeLesson("course-1", 1, lessonId, student.id);
    expect((await repository.getWorkspace(student)).lessonCompletions).toHaveLength(1);

    await expect(
      repository.completeLesson("course-1", 1, lessonId, otherStudent.id),
    ).rejects.toThrow();
    await expect(
      repository.completeLesson("course-1", 1, "missing-lesson", student.id),
    ).rejects.toThrow();
  });
  it("restricts teacher feedback and returns real course member names", async () => {
    await repository.insertCourse(draft());
    await repository.publishCourse("course-1", teacher.id);
    await repository.enroll("course-1", student.id);
    const feedback = {
      id: randomUUID(),
      courseId: "course-1",
      studentId: student.id,
      teacherId: teacher.id,
      message: "下一步请补充例子。",
      createdAt: new Date().toISOString(),
    };
    await expect(
      repository.insertFeedback({ ...feedback, teacherId: "other-teacher" }),
    ).rejects.toThrow(/access denied/i);
    await repository.insertFeedback(feedback);
    expect((await repository.getWorkspace(student)).feedback).toHaveLength(1);
    expect((await repository.getWorkspace(otherStudent)).feedback).toHaveLength(
      0,
    );
    expect((await repository.getWorkspace(teacher)).members[0].name).toBe(
      student.name,
    );
  });
  it("inserts a published personal course, its revision and enrollment atomically", async () => {
    const personal: Course = {
      ...draft(),
      id: "personal-1",
      ownerId: student.id,
      visibility: "personal",
      status: "published",
      publishedContent: undefined,
    };
    await repository.insertCourse(personal);
    const revisions = await postgres.pool.query(
      "select version from course_revisions where course_id = $1",
      [personal.id],
    );
    expect(revisions.rows).toHaveLength(1);
    const enrollment = await postgres.pool.query(
      "select 1 from enrollments where course_id = $1 and student_id = $2",
      [personal.id, student.id],
    );
    expect(enrollment.rowCount).toBe(1);
    expect(
      (await repository.getWorkspace(student)).courses.some(
        (course) => course.id === personal.id,
      ),
    ).toBe(true);
  });
  it("persists AI generation records and every saved learning path", async () => {
    const now = Date.now();
    await repository.insertGenerationRecord({
      id: "generation-1",
      ownerId: teacher.id,
      kind: "course",
      courseId: null,
      input: { topic: "需求分析" },
      result: { title: "课程" },
      createdAt: new Date(now).toISOString(),
    });
    const records = await repository.listGenerationRecords(teacher.id, {
      kind: "course",
    });
    expect(records).toHaveLength(1);
    expect(records[0].input).toEqual({ topic: "需求分析" });
    expect(records[0].result).toEqual({ title: "课程" });

    const path = (id: string, title: string, createdAt: string) => ({
      id,
      ownerId: student.id,
      title,
      steps: [
        {
          courseId: "course-1",
          courseVersion: 1,
          order: 0,
          targetMinutes: 30,
          reason: "起点",
        },
      ],
      createdAt,
      updatedAt: createdAt,
    });
    await repository.saveLearningPath(
      path("path-1", "旧路径", new Date(now).toISOString()),
    );
    await repository.saveLearningPath(
      path("path-2", "新路径", new Date(now + 1000).toISOString()),
    );
    const paths = await repository.listLearningPaths(student.id);
    expect(paths).toHaveLength(2);
    expect(paths[0].title).toBe("新路径");
    expect((await repository.getLearningPath(student.id))?.title).toBe(
      "新路径",
    );
  });
});
