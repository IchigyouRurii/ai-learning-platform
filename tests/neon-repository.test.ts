import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  editableCourseLevels,
  lessonsAtLevel,
  type Course,
  type Submission,
  type User,
} from "@/shared/contracts";
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
    "202611010001_enrollment_difficulty.sql",
    "202611040001_course_materials.sql",
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
  it("lists and reads only active published teaching revisions without answer keys", async () => {
    const otherTeacher: User = { ...teacher, id: "other-teacher" };
    await repository.insertCourse(draft());
    expect(await repository.listCatalog(otherTeacher)).toEqual([]);
    expect(
      await repository.findPublishedCourse(otherTeacher, "course-1"),
    ).toBeNull();
    await repository.publishCourse("course-1", teacher.id);
    const original = (await repository.listCatalog(otherTeacher))[0];
    expect(original).toMatchObject({
      id: "course-1",
      author: teacher.name,
      status: "published",
      version: 1,
    });
    expect(original).not.toHaveProperty("lessons");
    expect(original).not.toHaveProperty("content");
    const document = (await repository.getCourseDocument("course-1"))!;
    await repository.updateCourseDraft(
      "course-1",
      teacher.id,
      document.draftRevision,
      { ...document.content, title: "Unpublished secret" },
    );
    expect((await repository.listCatalog(student))[0].title).toBe(
      original.title,
    );
    const published = await repository.findPublishedCourse(
      otherTeacher,
      "course-1",
    );
    expect(published?.content.title).toBe(original.title);
    expect(JSON.stringify(published)).not.toContain("correctOptionIds");
    expect(JSON.stringify(published)).not.toContain('"explanation"');
    expect(JSON.stringify(published)).not.toContain("publishedContent");
    await repository.insertCourse({
      ...draft(),
      id: "personal-1",
      ownerId: student.id,
      visibility: "personal",
      status: "published",
    });
    expect(
      (await repository.listCatalog(teacher)).map((item) => item.id),
    ).toEqual(["course-1"]);
    expect(
      await repository.findPublishedCourse(teacher, "personal-1"),
    ).toBeNull();
    expect(
      await repository.findPublishedCourse(
        otherTeacher,
        "course-1' OR true --",
      ),
    ).toBeNull();
    await postgres.pool.query(
      'insert into "user" (id, name, role) values ($1, $2, $3)',
      ["moderator", "Moderator", "admin"],
    );
    await postgres.pool.query(
      "update courses set moderation_status = 'withdrawn', moderation_reason = 'Test withdrawal', moderated_by = 'moderator', moderated_at = now() where id = $1",
      ["course-1"],
    );
    expect(await repository.listCatalog(teacher)).toEqual([]);
    expect(
      await repository.findPublishedCourse(otherTeacher, "course-1"),
    ).toBeNull();
  });
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

    await repository.completeLesson(
      "course-1",
      1,
      lessonId,
      otherStudent.id,
      false,
    );
    expect(
      (await repository.getWorkspace(student)).lessonCompletions,
    ).toHaveLength(1);
    await repository.completeLesson("course-1", 1, lessonId, student.id, false);
    await repository.completeLesson("course-1", 1, lessonId, student.id, false);
    expect(
      (await repository.getWorkspace(student)).lessonCompletions,
    ).toHaveLength(0);
    await repository.completeLesson("course-1", 1, lessonId, student.id);
    expect(
      (await repository.getWorkspace(student)).lessonCompletions,
    ).toHaveLength(1);

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
    expect((await repository.getWorkspace(teacher)).feedback).toHaveLength(1);
    expect(
      (await repository.getWorkspace({ ...teacher, id: "teacher-2" })).feedback,
    ).toHaveLength(0);
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
    await repository.insertCourse(draft());
    await repository.publishCourse("course-1", teacher.id);
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

it("persists independent difficulty materials and preserves the previous immutable publication", async () => {
  await repository.insertCourse(draft());
  await repository.publishCourse("course-1", teacher.id);
  const original = await repository.findPublishedCourse(teacher, "course-1");
  const document = await repository.getCourseDocument("course-1");
  const content = editableCourseLevels(document!.content);
  const expert = content.lessons.find(
    (lesson) => lesson.difficulty === "expert",
  )!;
  expert.title = "Expert scenario analysis";
  await repository.updateCourseDraft(
    "course-1",
    teacher.id,
    document!.draftRevision,
    content,
  );
  const unpublished = await repository.findPublishedCourse(teacher, "course-1");
  expect(unpublished).toEqual(original);
  await repository.publishCourse("course-1", teacher.id);
  const published = await repository.findPublishedCourse(teacher, "course-1");
  expect(lessonsAtLevel(published!.content.lessons, "expert")[0].title).toBe(
    "Expert scenario analysis",
  );
  expect(
    lessonsAtLevel(published!.content.lessons, "beginner")[0].title,
  ).not.toBe("Expert scenario analysis");
  expect(JSON.stringify(published)).not.toContain("correctOptionIds");
  const oldRevision = await postgres.pool.query<{ content: unknown }>(
    "select content from course_revisions where course_id = $1 and version = 1",
    ["course-1"],
  );
  expect(
    (oldRevision.rows[0].content as Course).lessons.every(
      (lesson) => !lesson.difficulty,
    ),
  ).toBe(true);
});

it("loads one student course in one query before enrollment and only its own records after enrollment", async () => {
  await repository.insertCourse(draft());
  await repository.publishCourse("course-1", teacher.id);
  await repository.insertCourse({ ...draft(), id: "course-2" });
  await repository.publishCourse("course-2", teacher.id);
  let queries = 0;
  const focused = createNeonRepository({
    ...postgres.pool,
    query: (...args: Parameters<typeof postgres.pool.query>) => {
      queries++;
      return postgres.pool.query(...args);
    },
  } as typeof postgres.pool);
  const preview = await focused.getStudentCourseContext(student, "course-1");
  expect(preview).toMatchObject({
    course: { id: "course-1" },
    enrolled: false,
    submissions: [],
    lessonCompletions: [],
  });
  expect(queries).toBe(1);
  await repository.enroll("course-1", student.id);
  await repository.enroll("course-1", otherStudent.id);
  await repository.enroll("course-2", student.id);
  const mine = await repository.insertSubmission(submission());
  await repository.insertSubmission({
    ...submission(),
    studentId: otherStudent.id,
  });
  await repository.insertSubmission({ ...submission(), courseId: "course-2" });
  queries = 0;
  const learning = await focused.getStudentCourseContext(student, "course-1");
  expect(learning?.submissions.map((item) => item.id)).toEqual([mine.id]);
  expect(queries).toBe(3);
});

it("denies hidden, withdrawn, foreign personal and injected student detail requests", async () => {
  await repository.insertCourse(draft());
  expect(
    await repository.getStudentCourseContext(student, "course-1"),
  ).toBeNull();
  await repository.publishCourse("course-1", teacher.id);
  expect(
    await repository.getStudentCourseContext(student, "' OR '1'='1"),
  ).toBeNull();
  await expect(
    repository.getStudentCourseContext(teacher, "course-1"),
  ).rejects.toThrow("Student");
  await repository.insertCourse({
    ...draft(),
    id: "personal-course",
    ownerId: student.id,
    status: "published",
    visibility: "personal",
  });
  expect(
    await repository.getStudentCourseContext(otherStudent, "personal-course"),
  ).toBeNull();
  expect(
    (await repository.getStudentCourseContext(student, "personal-course"))
      ?.course.id,
  ).toBe("personal-course");
  await postgres.pool.query(
    'insert into "user" (id,name,role) values ($1,$2,$3)',
    ["detail-moderator", "Moderator", "admin"],
  );
  await postgres.pool.query(
    "update courses set moderation_status='withdrawn',moderation_reason='Test withdrawal',moderated_by='detail-moderator',moderated_at=now() where id=$1",
    ["course-1"],
  );
  expect(
    await repository.getStudentCourseContext(student, "course-1"),
  ).toBeNull();
});

it("switches one active difficulty and preserves independent legacy-ID learning records", async () => {
  await repository.insertCourse(draft());
  await repository.publishCourse("course-1", teacher.id);
  await repository.enroll("course-1", student.id);
  expect(await repository.getActiveCourseLevel("course-1", student.id)).toBe(
    "beginner",
  );
  const original = (await repository.findCourse("course-1"))!;
  const lessonId = original.lessons[0].id;
  const before = JSON.stringify(original.lessons);
  const beginner = await repository.insertSubmission({
    ...submission(),
    difficulty: "beginner",
  });
  await repository.completeLesson(
    "course-1",
    1,
    lessonId,
    student.id,
    true,
    "beginner",
  );
  await repository.switchCourseLevel(
    "course-1",
    student.id,
    "beginner",
    "advanced",
    1,
  );
  let context = (await repository.getStudentCourseContext(
    student,
    "course-1",
  ))!;
  expect(context).toMatchObject({
    activeLevel: "advanced",
    submissions: [],
    lessonCompletions: [],
  });
  await expect(
    repository.insertSubmission({ ...submission(), difficulty: "beginner" }),
  ).rejects.toThrow();
  await expect(
    repository.completeLesson(
      "course-1",
      1,
      lessonId,
      student.id,
      true,
      "beginner",
    ),
  ).rejects.toThrow();
  await repository.insertSubmission({
    ...submission(),
    difficulty: "advanced",
  });
  await repository.completeLesson(
    "course-1",
    1,
    lessonId,
    student.id,
    true,
    "advanced",
  );
  await expect(
    repository.switchCourseLevel(
      "course-1",
      otherStudent.id,
      "beginner",
      "expert",
      1,
    ),
  ).rejects.toThrow();
  await expect(
    repository.switchCourseLevel(
      "course-1",
      student.id,
      "beginner",
      "expert",
      1,
    ),
  ).rejects.toThrow();
  await repository.switchCourseLevel(
    "course-1",
    student.id,
    "advanced",
    "beginner",
    1,
  );
  context = (await repository.getStudentCourseContext(student, "course-1"))!;
  expect(context.submissions.map((item) => item.id)).toEqual([beginner.id]);
  expect(context.lessonCompletions).toHaveLength(1);
  expect(
    (
      await postgres.pool.query(
        "select count(*)::int as n from lesson_completions where course_id=$1",
        ["course-1"],
      )
    ).rows[0].n,
  ).toBe(2);
  expect(
    (
      await postgres.pool.query(
        "select count(*)::int as n from enrollments where course_id=$1 and student_id=$2",
        ["course-1", student.id],
      )
    ).rows[0].n,
  ).toBe(1);
  expect(
    JSON.stringify((await repository.findCourse("course-1"))!.lessons),
  ).toBe(before);
});

it("rejects selecting a difficulty without published materials", async () => {
  const course = draft();
  course.lessons = course.lessons.map((lesson) => ({
    ...lesson,
    difficulty: "beginner",
  }));
  await repository.insertCourse(course);
  await repository.publishCourse(course.id, teacher.id);
  await expect(
    repository.enroll(course.id, student.id, "expert"),
  ).rejects.toThrow();
  await repository.enroll(course.id, student.id);
  await expect(
    repository.switchCourseLevel(
      course.id,
      student.id,
      "beginner",
      "expert",
      1,
    ),
  ).rejects.toThrow();
  expect(await repository.getActiveCourseLevel(course.id, student.id)).toBe(
    "beginner",
  );
});

it("updates only the owner's path and rejects private, stale or withdrawn courses", async () => {
  await repository.insertCourse(draft());
  await repository.publishCourse("course-1", teacher.id);
  const now = new Date().toISOString();
  const path = {
    id: "editable-path",
    ownerId: student.id,
    title: "Original route",
    steps: [
      {
        courseId: "course-1",
        courseVersion: 1,
        order: 0,
        difficulty: "expert" as const,
        targetMinutes: 60,
        reason: "Learn this next.",
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
  await repository.saveLearningPath(path);
  await repository.saveLearningPath({ ...path, title: "Updated route" });
  expect(await repository.listLearningPaths(student.id)).toHaveLength(1);
  expect((await repository.getLearningPath(student.id))?.title).toBe(
    "Updated route",
  );
  await expect(
    repository.saveLearningPath({
      ...path,
      ownerId: otherStudent.id,
      title: "Stolen route",
    }),
  ).rejects.toThrow("no longer available");
  expect(await repository.listLearningPaths(otherStudent.id)).toHaveLength(0);
  await expect(
    repository.saveLearningPath({
      ...path,
      steps: [{ ...path.steps[0], courseVersion: 99 }],
    }),
  ).rejects.toThrow("no longer available");
  await postgres.pool.query(
    "update courses set visibility = 'personal' where id = $1",
    ["course-1"],
  );
  await expect(repository.saveLearningPath(path)).rejects.toThrow(
    "no longer available",
  );
  await postgres.pool.query(
    "update courses set visibility = 'cohort', moderation_status = 'withdrawn', moderation_reason = 'test', moderated_at = now(), moderated_by = $2 where id = $1",
    ["course-1", teacher.id],
  );
  await expect(repository.saveLearningPath(path)).rejects.toThrow(
    "no longer available",
  );
  expect((await repository.getLearningPath(student.id))?.title).toBe(
    "Updated route",
  );
});

it("leaves without deleting progress and restores same-level progress after re-enrollment", async () => {
  await repository.insertCourse(draft());
  await repository.publishCourse("course-1", teacher.id);
  await repository.enroll("course-1", student.id, "beginner");
  await repository.insertSubmission({
    ...submission(),
    difficulty: "beginner",
  });
  await repository.completeLesson(
    "course-1",
    1,
    draft().lessons[0].id,
    student.id,
    true,
    "beginner",
  );
  await expect(
    repository.leaveCourse("course-1", otherStudent.id),
  ).rejects.toThrow();
  expect(await repository.isEnrolled("course-1", student.id)).toBe(true);
  await repository.leaveCourse("course-1", student.id);
  expect(await repository.isEnrolled("course-1", student.id)).toBe(false);
  expect((await repository.getWorkspace(student)).enrollments).toHaveLength(0);
  await expect(repository.insertSubmission(submission())).rejects.toThrow();
  expect((await repository.getWorkspace(student)).submissions).toHaveLength(1);
  expect(
    (await repository.getWorkspace(student)).lessonCompletions,
  ).toHaveLength(1);
  await repository.enroll("course-1", student.id, "expert");
  expect(
    (await repository.getStudentCourseContext(student, "course-1"))
      ?.submissions,
  ).toHaveLength(0);
  await repository.switchCourseLevel(
    "course-1",
    student.id,
    "expert",
    "beginner",
    1,
  );
  const restored = await repository.getStudentCourseContext(
    student,
    "course-1",
  );
  expect(restored?.submissions).toHaveLength(1);
  expect(restored?.lessonCompletions).toHaveLength(1);
});

it("blocks leaving class courses even through a direct repository call", async () => {
  await repository.insertCourse(draft());
  await repository.publishCourse("course-1", teacher.id);
  await repository.enroll("course-1", student.id);
  await postgres.pool.query(
    "insert into classrooms (id, teacher_id, course_id, name) values ($1, $2, $3, $4)",
    ["class-1", teacher.id, "course-1", "Test class"],
  );
  await expect(repository.leaveCourse("course-1", student.id)).rejects.toThrow(
    "Class courses cannot be left",
  );
  expect(await repository.isEnrolled("course-1", student.id)).toBe(true);
});

it("does not allow students to leave their own created courses", async () => {
  await repository.insertCourse({
    ...draft(),
    id: "own-course",
    ownerId: student.id,
    visibility: "personal",
    status: "published",
  });
  expect(await repository.isEnrolled("own-course", student.id)).toBe(true);
  await expect(
    repository.leaveCourse("own-course", student.id),
  ).rejects.toThrow();
  expect(await repository.isEnrolled("own-course", student.id)).toBe(true);
});

it("deletes an author's private course and own records atomically", async () => {
  await repository.insertCourse({
    ...draft(),
    id: "personal-delete",
    ownerId: student.id,
    visibility: "personal",
    status: "published",
  });
  await repository.insertSubmission({
    ...submission(),
    courseId: "personal-delete",
    difficulty: "beginner",
  });
  await repository.completeLesson(
    "personal-delete",
    1,
    draft().lessons[0].id,
    student.id,
    true,
    "beginner",
  );
  await expect(
    repository.deleteOwnedCourse("personal-delete", otherStudent.id),
  ).rejects.toThrow("only delete courses you created");
  expect(await repository.findCourse("personal-delete")).not.toBeNull();
  await repository.deleteOwnedCourse("personal-delete", student.id);
  expect(await repository.findCourse("personal-delete")).toBeNull();
  for (const table of [
    "course_revisions",
    "enrollments",
    "submissions",
    "lesson_completions",
  ]) {
    expect(
      (
        await postgres.pool.query(`select 1 from ${table} where course_id=$1`, [
          "personal-delete",
        ])
      ).rows,
    ).toHaveLength(0);
  }
});

it("never allows teachers to delete their own drafts or published courses", async () => {
  await repository.insertCourse(draft());
  expect(await repository.canDeleteOwnedCourse("course-1", teacher.id)).toBe(
    false,
  );
  await expect(
    repository.deleteOwnedCourse("course-1", teacher.id),
  ).rejects.toThrow();
  await repository.publishCourse("course-1", teacher.id);
  await expect(
    repository.deleteOwnedCourse("course-1", teacher.id),
  ).rejects.toThrow();
  expect(await repository.findCourse("course-1")).not.toBeNull();
});

it("keeps teacher courses and their learner records intact", async () => {
  await repository.insertCourse(draft());
  await repository.publishCourse("course-1", teacher.id);
  await repository.enroll("course-1", student.id);
  await repository.insertSubmission(submission());
  expect(await repository.canDeleteOwnedCourse("course-1", teacher.id)).toBe(
    false,
  );
  await expect(
    repository.deleteOwnedCourse("course-1", teacher.id),
  ).rejects.toThrow();
  expect((await repository.getWorkspace(student)).submissions).toHaveLength(1);
});

it("returns author catalog metadata only and isolates ownership", async () => {
  await repository.insertCourse(draft());
  await repository.insertCourse({
    ...draft(),
    id: "private-catalog",
    ownerId: student.id,
    visibility: "personal",
    status: "published",
  });
  const owned = await repository.listOwnedCatalog(teacher);
  expect(owned.map((item) => item.id)).toEqual(["course-1"]);
  expect(owned[0].status).toBe("draft");
  expect(owned[0]).not.toHaveProperty("lessons");
  expect(owned[0]).not.toHaveProperty("content");
  expect(
    (await repository.listOwnedCatalog(student)).map((item) => item.id),
  ).toEqual(["private-catalog"]);
  expect(await repository.listOwnedCatalog(otherStudent)).toEqual([]);
});

it("only permits deletion of the student's own personal course", async () => {
  await repository.insertCourse({
    ...draft(),
    id: "student-only-delete",
    ownerId: student.id,
    visibility: "personal",
    status: "published",
  });
  expect(
    await repository.canDeleteOwnedCourse("student-only-delete", student.id),
  ).toBe(true);
  expect(
    await repository.canDeleteOwnedCourse(
      "student-only-delete",
      otherStudent.id,
    ),
  ).toBe(false);
  expect(
    await repository.canDeleteOwnedCourse("student-only-delete", teacher.id),
  ).toBe(false);
  await expect(
    repository.deleteOwnedCourse("student-only-delete", otherStudent.id),
  ).rejects.toThrow();
  expect(await repository.findCourse("student-only-delete")).not.toBeNull();
});
