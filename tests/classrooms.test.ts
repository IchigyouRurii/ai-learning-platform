import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Course, Submission, User } from "@/shared/contracts";
import { createClassroomRepository } from "@/shared/database/classroom-repository";
import {
  createClassroomService,
  hashJoinCode,
} from "@/modules/platform/server/classroom-service";
import { createNeonRepository } from "@/shared/database/neon-repository";
import { createSeedState } from "@/shared/database/seed";
import { createTestPostgres } from "./helpers/postgres";
const external = vi.hoisted(() => ({ repository: vi.fn() }));
vi.mock("@/shared/database", () => ({ getRepository: external.repository }));
import {
  getAssignedLearningCourse,
  getLearningContext,
  recordSubmission,
} from "@/modules/platform/server/services";
let postgres: Awaited<ReturnType<typeof createTestPostgres>>;
let repo: ReturnType<typeof createClassroomRepository>;
let courses: ReturnType<typeof createNeonRepository>;
let service: ReturnType<typeof createClassroomService>;
const teacher: User = { id: "teacher", name: "Teacher One", role: "teacher" };
const otherTeacher: User = {
  id: "other-teacher",
  name: "Teacher Two",
  role: "teacher",
};
const student: User = { id: "student", name: "Student One", role: "student" };
const other: User = { id: "other", name: "Student Two", role: "student" };
const admin: User = { id: "admin", name: "Admin", role: "admin" };
const codeOf = async (classId: string) => {
  const result = await service.createJoinCode(teacher, { classId });
  if (!result.ok) throw new Error(result.error);
  return result.data.code;
};
const createClass = (name = "Software Engineering") =>
  repo.create(teacher, { name, description: "A shared learning space" });
async function teachingCourse(id = "course-1", actor = teacher) {
  const course: Course = {
    ...createSeedState().courses[0],
    id,
    ownerId: actor.id,
    status: "draft",
  };
  await courses.insertCourse(course);
  return courses.publishCourse(id, actor.id);
}
const attempt = (course: Course): Submission => ({
  id: randomUUID(),
  courseId: course.id,
  courseVersion: course.version,
  activityId: "ai-coding-r1",
  studentId: student.id,
  answer: "A clear, testable requirement.",
  aiFeedback: "Add a concrete example.",
  createdAt: new Date().toISOString(),
});
beforeAll(async () => {
  postgres = await createTestPostgres();
  await postgres.database.exec(
    'create table "user" (id text primary key, name text, role text, email text)',
  );
  for (const name of [
    "202610170001_neon.sql",
    "202610220001_course_editing.sql",
    "202610250001_ai_history.sql",
    "202610270001_administration.sql",
    "202610270002_classrooms.sql",
    "202610270003_admin_classrooms.sql",
  ])
    await postgres.database.exec(
      await readFile(
        new URL(`../database/migrations/${name}`, import.meta.url),
        "utf8",
      ),
    );
  repo = createClassroomRepository(postgres.pool);
  courses = createNeonRepository(postgres.pool);
  service = createClassroomService(() => repo);
  external.repository.mockReturnValue(courses);
}, 30000);
beforeEach(async () => {
  await postgres.database.exec('truncate table "user" cascade');
  for (const user of [teacher, otherTeacher, student, other, admin])
    await postgres.pool.query(
      'insert into "user" (id, name, role, email) values ($1,$2,$3,$4)',
      [user.id, user.name, user.role, `${user.id}@example.com`],
    );
});
afterAll(async () => {
  if (postgres) await postgres.database.close();
});

describe("classroom service and ownership", () => {
  it("rejects no session, wrong roles, forged authority and invalid input before accessing storage", async () => {
    const provider = vi.fn(() => repo);
    const guarded = createClassroomService(provider);
    expect(await guarded.create(null, { name: "Class" })).toMatchObject({
      code: "AUTH_REQUIRED",
    });
    expect(await guarded.create(student, { name: "Class" })).toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await guarded.joinByCode(teacher, { code: "ABC123" })).toMatchObject(
      { code: "FORBIDDEN" },
    );
    expect(
      await guarded.create(teacher, { name: " ", description: "" }),
    ).toMatchObject({ code: "INVALID_INPUT" });
    expect(
      await guarded.create(teacher, { name: "Class", teacherId: "forged" } as {
        name: string;
      }),
    ).toMatchObject({ code: "INVALID_INPUT" });
    expect(provider).not.toHaveBeenCalled();
  });
  it("rechecks actual database roles even for forged or stale actors", async () => {
    await expect(
      repo.create(
        { ...student, role: "teacher" },
        { name: "Forged", description: "" },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await postgres.pool.query('update "user" set role = $2 where id = $1', [
      teacher.id,
      "admin",
    ]);
    expect(await service.create(teacher, { name: "Stale" })).toMatchObject({
      code: "FORBIDDEN",
    });
    expect(
      (await postgres.pool.query("select id from classrooms")).rows,
    ).toHaveLength(0);
  });
  it("creates and updates only owned classes, safely scopes all reads and paginates tied timestamps", async () => {
    const classroom = await createClass();
    const second = await createClass("Second Class");
    await postgres.pool.query(
      "update classrooms set created_at = '2026-10-27T01:00:00.123456Z'",
    );
    expect(
      (await repo.listMine(otherTeacher, { limit: 20 })).items,
    ).toHaveLength(0);
    expect(await repo.findForActor(student, classroom.id)).toBeNull();
    await expect(
      repo.listMembers(otherTeacher, classroom.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      repo.update(otherTeacher, {
        classId: classroom.id,
        name: "Forged",
        description: "",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      await repo.update(teacher, {
        classId: classroom.id,
        name: "Renamed",
        description: "New",
      }),
    ).toMatchObject({ name: "Renamed" });
    const firstPage = await repo.listMine(teacher, { limit: 1 });
    const next = await repo.listMine(teacher, {
      limit: 1,
      cursor: firstPage.nextCursor!,
    });
    expect(
      new Set([...firstPage.items, ...next.items].map((item) => item.id)),
    ).toEqual(new Set([classroom.id, second.id]));
    expect(
      await service.listMine(teacher, { cursor: "invalid" }),
    ).toMatchObject({ code: "INVALID_INPUT" });
  });
  it("returns safe failures without raw SQL or credentials and keeps email invitations reserved", async () => {
    const broken = createClassroomService(() => {
      throw new Error("postgres://secret@database.private SQL failed");
    });
    const result = await broken.create(teacher, { name: "Test" });
    expect(result).toMatchObject({ code: "INTERNAL_ERROR" });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(
      await service.inviteStudents(teacher, {
        classId: "class",
        emails: ["student@example.com"],
      }),
    ).toMatchObject({ code: "NOT_IMPLEMENTED" });
  });
});

describe("class membership and invitations", () => {
  it("stores only a strong code hash, rotates codes, and joins idempotently", async () => {
    const classroom = await createClass();
    const original = await codeOf(classroom.id);
    expect(original).toHaveLength(20);
    const stored = await postgres.pool.query(
      "select * from classroom_join_codes",
    );
    expect(JSON.stringify(stored.rows)).not.toContain(original);
    expect(stored.rows[0].token_hash).toBe(hashJoinCode(original));
    const replacement = await codeOf(classroom.id);
    expect(await service.joinByCode(student, { code: original })).toMatchObject(
      { code: "NOT_FOUND" },
    );
    expect(
      await service.joinByCode(student, {
        code: `  ${replacement.toLowerCase()} `,
      }),
    ).toMatchObject({ ok: true, data: { id: classroom.id, memberCount: 1 } });
    expect(
      await service.joinByCode(student, { code: replacement }),
    ).toMatchObject({ ok: true });
    expect(await repo.listMembers(teacher, classroom.id)).toHaveLength(1);
    expect((await repo.listMine(student, { limit: 20 })).items).toHaveLength(1);
    expect((await repo.listMine(other, { limit: 20 })).items).toHaveLength(0);
    expect(
      JSON.stringify(await repo.listMembers(teacher, classroom.id)),
    ).not.toContain("email");
  });
  it("rejects expired codes and persists limits across failed requests", async () => {
    const classroom = await createClass();
    const code = await codeOf(classroom.id);
    await postgres.pool.query(
      "update classroom_join_codes set expires_at = now() - interval '1 minute'",
    );
    expect(await service.joinByCode(student, { code })).toMatchObject({
      code: "NOT_FOUND",
    });
    for (let i = 0; i < 9; i++)
      expect(
        await service.joinByCode(student, { code: "INVALID" }),
      ).toMatchObject({ code: "NOT_FOUND" });
    expect(await service.joinByCode(student, { code })).toMatchObject({
      code: "RATE_LIMITED",
    });
    await postgres.pool.query(
      "update classroom_join_attempts set window_start = now() - interval '16 minutes'",
    );
    expect(await service.joinByCode(student, { code })).toMatchObject({
      code: "NOT_FOUND",
    });
  });
  it("imports only existing students without duplicates or account creation", async () => {
    const classroom = await createClass();
    const input = {
      classId: classroom.id,
      emails: [
        "STUDENT@example.com",
        "student@example.com",
        "teacher@example.com",
        "missing@example.com",
      ],
    };
    const result = await service.importStudents(teacher, input);
    expect(result).toMatchObject({
      ok: true,
      data: {
        added: [student.id],
        missingEmails: ["teacher@example.com", "missing@example.com"],
      },
    });
    expect(await service.importStudents(teacher, input)).toMatchObject({
      ok: true,
      data: { added: [] },
    });
    expect(
      (await postgres.pool.query('select id from "user"')).rows,
    ).toHaveLength(5);
    expect(await repo.listMembers(teacher, classroom.id)).toHaveLength(1);
    expect(await service.importStudents(otherTeacher, input)).toMatchObject({
      code: "NOT_FOUND",
    });
  });
  it("does not let a promoted former student use a stale membership as a teacher's class access", async () => {
    const classroom = await createClass();
    await repo.importExistingStudents(teacher, classroom.id, [
      "student@example.com",
    ]);
    await postgres.pool.query('update "user" set role = $2 where id = $1', [
      student.id,
      "teacher",
    ]);
    expect(
      await repo.findForActor({ ...student, role: "teacher" }, classroom.id),
    ).toBeNull();
    expect(
      (
        await repo.listAssignments(
          { ...student, role: "teacher" },
          { limit: 20 },
        )
      ).items,
    ).toHaveLength(0);
  });
});

describe("versioned class assignments and learning access", () => {
  it("assigns only owned published active teaching versions, never private courses or drafts", async () => {
    const classroom = await createClass();
    const course = await teachingCourse();
    const otherCourse = await teachingCourse("other-course", otherTeacher);
    await courses.insertCourse({ ...course, id: "draft", status: "draft" });
    await courses.insertCourse({
      ...course,
      id: "personal",
      ownerId: student.id,
      visibility: "personal",
      status: "published",
    });
    for (const [courseId, courseVersion] of [
      [otherCourse.id, 1],
      [course.id, 999],
      ["draft", 1],
      ["personal", 1],
    ] as const)
      expect(
        await service.assignCourse(teacher, {
          classId: classroom.id,
          courseId,
          courseVersion,
        }),
      ).toMatchObject({ code: "NOT_FOUND" });
    expect(
      await service.assignCourse(otherTeacher, {
        classId: classroom.id,
        courseId: course.id,
        courseVersion: 1,
      }),
    ).toMatchObject({ code: "NOT_FOUND" });
    const options = await repo.listAssignableCourses(teacher, classroom.id);
    expect(options.map((item) => item.id)).toEqual([course.id]);
    expect(JSON.stringify(options)).not.toContain("lessons");
    const assignment = await repo.assignCourse(teacher, {
      classId: classroom.id,
      courseId: course.id,
      courseVersion: 1,
      dueAt: "2026-11-30T12:00:00Z",
    });
    expect(
      await repo.assignCourse(teacher, {
        classId: classroom.id,
        courseId: course.id,
        courseVersion: 1,
      }),
    ).toEqual(assignment);
    expect(
      (await repo.findForActor(teacher, classroom.id))?.assignmentCount,
    ).toBe(1);
  });
  it("joins before or after assignment without granting direct enrollment and isolates other students", async () => {
    const classroom = await createClass();
    const course = await teachingCourse();
    await repo.importExistingStudents(teacher, classroom.id, [
      "student@example.com",
    ]);
    await repo.assignCourse(teacher, {
      classId: classroom.id,
      courseId: course.id,
      courseVersion: 1,
    });
    expect(await courses.isEnrolled(course.id, student.id, 1)).toBe(true);
    expect(await courses.isEnrolled(course.id, other.id, 1)).toBe(false);
    expect(
      (await postgres.pool.query("select direct_access from enrollments"))
        .rows[0].direct_access,
    ).toBe(false);
    expect(
      (await repo.listAssignments(other, { limit: 20 })).items,
    ).toHaveLength(0);
    await expect(
      repo.listAssignments(other, { classId: classroom.id, limit: 20 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await service.joinByCode(other, { code: await codeOf(classroom.id) });
    expect(await courses.isEnrolled(course.id, other.id, 1)).toBe(true);
    expect((await courses.getWorkspace(student)).enrollments).toHaveLength(1);
  });
  it("retains assigned content and activity records at version 1 after publishing version 2", async () => {
    const classroom = await createClass();
    const course = await teachingCourse();
    await repo.assignCourse(teacher, {
      classId: classroom.id,
      courseId: course.id,
      courseVersion: 1,
    });
    await repo.importExistingStudents(teacher, classroom.id, [
      "student@example.com",
    ]);
    const document = (await courses.getCourseDocument(course.id))!;
    await courses.updateCourseDraft(
      course.id,
      teacher.id,
      document.draftRevision,
      {
        ...document.content,
        title: "Updated version",
        lessons: document.content.lessons.map((lesson) => ({
          ...lesson,
          blocks: lesson.blocks.filter(
            (block) =>
              block.type !== "activity" || block.activity.id !== "ai-coding-r1",
          ),
        })),
      },
    );
    await courses.publishCourse(course.id, teacher.id);
    expect((await courses.findCourse(course.id))?.version).toBe(2);
    expect(
      await getAssignedLearningCourse(student, course.id, 1),
    ).toMatchObject({ version: 1, title: course.title });
    expect(
      (await getLearningContext(student, course.id, "ai-coding-r1", 1)).course
        .version,
    ).toBe(1);
    await courses.insertSubmission(attempt(course));
    const {
      id: _id,
      studentId: _studentId,
      createdAt: _createdAt,
      ...payload
    } = attempt(course);
    void _id;
    void _studentId;
    void _createdAt;
    await recordSubmission(student, payload);
    expect((await courses.getWorkspace(student)).submissions).toHaveLength(2);
    expect((await courses.getWorkspace(student)).enrollments).toHaveLength(0);
    expect(await courses.isEnrolled(course.id, student.id, 2)).toBe(false);
    await expect(
      getAssignedLearningCourse(student, course.id, 2),
    ).rejects.toThrow("enroll");
    expect(
      (await repo.listAssignments(student, { limit: 20 })).items[0],
    ).toMatchObject({ courseVersion: 1, title: course.title });
  });
  it("revokes class-only access on member removal while preserving submissions and feedback", async () => {
    const classroom = await createClass();
    const course = await teachingCourse();
    await repo.importExistingStudents(teacher, classroom.id, [
      "student@example.com",
    ]);
    await repo.assignCourse(teacher, {
      classId: classroom.id,
      courseId: course.id,
      courseVersion: 1,
    });
    await courses.insertSubmission(attempt(course));
    await courses.insertFeedback({
      id: "feedback",
      courseId: course.id,
      studentId: student.id,
      teacherId: teacher.id,
      message: "Keep going.",
      createdAt: new Date().toISOString(),
    });
    expect(await repo.removeMember(teacher, classroom.id, student.id)).toBe(
      true,
    );
    expect(await repo.removeMember(teacher, classroom.id, student.id)).toBe(
      false,
    );
    expect(await courses.isEnrolled(course.id, student.id, 1)).toBe(false);
    await expect(
      getAssignedLearningCourse(student, course.id, 1),
    ).rejects.toThrow("enroll");
    await expect(courses.insertSubmission(attempt(course))).rejects.toThrow(
      "enrollment",
    );
    expect((await courses.getWorkspace(student)).submissions).toHaveLength(1);
    expect((await courses.getWorkspace(student)).feedback).toHaveLength(1);
    expect(await repo.findForActor(student, classroom.id)).toBeNull();
  });
  it("keeps independent direct grants and other-class grants after removing one class", async () => {
    const first = await createClass();
    const second = await createClass("Second Class");
    const course = await teachingCourse();
    for (const classroom of [first, second]) {
      await repo.importExistingStudents(teacher, classroom.id, [
        "student@example.com",
      ]);
      await repo.assignCourse(teacher, {
        classId: classroom.id,
        courseId: course.id,
        courseVersion: 1,
      });
    }
    await repo.removeMember(teacher, first.id, student.id);
    expect(await courses.isEnrolled(course.id, student.id, 1)).toBe(true);
    await courses.enroll(course.id, student.id);
    await repo.removeMember(teacher, second.id, student.id);
    expect(await courses.isEnrolled(course.id, student.id, 1)).toBe(true);
    await courses.insertSubmission(attempt(course));
    expect(
      (await postgres.pool.query("select direct_access from enrollments"))
        .rows[0].direct_access,
    ).toBe(true);
  });
  it("soft-revokes assignments, preserves history, and permits deliberate reassignment", async () => {
    const classroom = await createClass();
    const course = await teachingCourse();
    await repo.importExistingStudents(teacher, classroom.id, [
      "student@example.com",
    ]);
    const assigned = await repo.assignCourse(teacher, {
      classId: classroom.id,
      courseId: course.id,
      courseVersion: 1,
    });
    await courses.insertSubmission(attempt(course));
    await expect(
      repo.removeAssignment(otherTeacher, classroom.id, assigned.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      await repo.removeAssignment(teacher, classroom.id, assigned.id),
    ).toBe(true);
    expect(
      await repo.removeAssignment(teacher, classroom.id, assigned.id),
    ).toBe(false);
    expect(
      (await repo.listAssignments(student, { limit: 20 })).items,
    ).toHaveLength(0);
    expect(await courses.isEnrolled(course.id, student.id, 1)).toBe(false);
    await expect(courses.insertSubmission(attempt(course))).rejects.toThrow(
      "enrollment",
    );
    expect((await courses.getWorkspace(student)).submissions).toHaveLength(1);
    expect(
      (
        await repo.assignCourse(teacher, {
          classId: classroom.id,
          courseId: course.id,
          courseVersion: 1,
        })
      ).id,
    ).toBe(assigned.id);
    expect(await courses.isEnrolled(course.id, student.id, 1)).toBe(true);
  });
  it("honors administrator withdrawal for every assigned version and prevents new assignments", async () => {
    const classroom = await createClass();
    const course = await teachingCourse();
    await repo.importExistingStudents(teacher, classroom.id, [
      "student@example.com",
    ]);
    await repo.assignCourse(teacher, {
      classId: classroom.id,
      courseId: course.id,
      courseVersion: 1,
    });
    await postgres.pool.query(
      "update courses set moderation_status = 'withdrawn', moderation_reason = 'Review', moderated_by = $1, moderated_at = now() where id = $2",
      [admin.id, course.id],
    );
    expect(
      (await repo.listAssignments(student, { limit: 20 })).items[0].available,
    ).toBe(false);
    expect(await courses.isEnrolled(course.id, student.id, 1)).toBe(false);
    await expect(
      getAssignedLearningCourse(student, course.id, 1),
    ).rejects.toThrow("withdrawn");
    await expect(courses.insertSubmission(attempt(course))).rejects.toThrow(
      "enrollment",
    );
    expect(
      await repo.listAssignableCourses(teacher, classroom.id),
    ).toHaveLength(0);
    expect(
      await service.assignCourse(teacher, {
        classId: classroom.id,
        courseId: course.id,
        courseVersion: 1,
      }),
    ).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("classroom migration compatibility and atomic grants", () => {
  it("preserves legacy shared classrooms, members and direct enrollments", async () => {
    const legacy = await createTestPostgres();
    try {
      await legacy.database.exec(
        'create table "user" (id text primary key, name text, role text, email text)',
      );
      for (const name of [
        "202610170001_neon.sql",
        "202610220001_course_editing.sql",
        "202610250001_ai_history.sql",
        "202610270001_administration.sql",
      ])
        await legacy.database.exec(
          await readFile(
            new URL(`../database/migrations/${name}`, import.meta.url),
            "utf8",
          ),
        );
      for (const user of [teacher, student, other])
        await legacy.pool.query(
          'insert into "user" (id,name,role,email) values ($1,$2,$3,$4)',
          [user.id, user.name, user.role, `${user.id}@example.com`],
        );
      const legacyCourses = createNeonRepository(legacy.pool);
      await legacyCourses.insertCourse({
        ...createSeedState().courses[0],
        id: "legacy-course",
        ownerId: teacher.id,
        status: "draft",
      });
      await legacyCourses.publishCourse("legacy-course", teacher.id);
      await legacy.database
        .exec(`create table classrooms (id text primary key, teacher_id text not null references "user"(id), name text not null, description text not null default '', created_at timestamptz not null default now(), course_id text not null references courses(id));
        create table classroom_members (class_id text not null references classrooms(id) on delete cascade, student_id text not null references "user"(id), joined_at timestamptz not null default now(), primary key(class_id, student_id));`);
      await legacy.pool.query(
        "insert into classrooms (id, teacher_id, name, course_id) values ('legacy-class', $1, 'Existing class', 'legacy-course')",
        [teacher.id],
      );
      await legacy.pool.query(
        "insert into classroom_members (class_id,student_id) values ('legacy-class',$1),('legacy-class',$2)",
        [student.id, other.id],
      );
      await legacy.pool.query(
        "insert into enrollments (course_id,student_id,joined_at) values ('legacy-course',$1,'2026-10-20T00:00:00Z')",
        [student.id],
      );
      await legacy.database.exec(
        await readFile(
          new URL(
            "../database/migrations/202610270002_classrooms.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      await legacy.database.exec(
        await readFile(
          new URL(
            "../database/migrations/202610270003_admin_classrooms.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const legacyRepo = createClassroomRepository(legacy.pool);
      expect(
        await legacyRepo.findForActor(teacher, "legacy-class"),
      ).toMatchObject({
        name: "Existing class",
        memberCount: 2,
        assignmentCount: 1,
      });
      expect(
        (await legacyRepo.listAssignments(student, { limit: 20 })).items[0],
      ).toMatchObject({ courseId: "legacy-course", courseVersion: 1 });
      const enrollments = (
        await legacy.pool.query(
          "select student_id, direct_access, joined_at from enrollments order by student_id",
        )
      ).rows;
      expect(
        enrollments.find((item) => item.student_id === student.id)
          ?.direct_access,
      ).toBe(true);
      expect(
        new Date(
          enrollments.find((item) => item.student_id === student.id)?.joined_at,
        ).toISOString(),
      ).toBe("2026-10-20T00:00:00.000Z");
      expect(
        enrollments.find((item) => item.student_id === other.id)?.direct_access,
      ).toBe(false);
      expect(
        await legacyRepo.create(teacher, {
          name: "New multi-course class",
          description: "",
        }),
      ).toMatchObject({ memberCount: 0, assignmentCount: 0 });
    } finally {
      await legacy.database.close();
    }
  });
  it("rolls back membership when the corresponding historical enrollment cannot be created", async () => {
    const classroom = await createClass();
    const course = await teachingCourse();
    await repo.assignCourse(teacher, {
      classId: classroom.id,
      courseId: course.id,
      courseVersion: 1,
    });
    await postgres.database
      .exec(`create function reject_class_enrollment() returns trigger language plpgsql as $$ begin raise exception 'test failure'; end; $$;
      create trigger reject_class_enrollment before insert on enrollments for each row execute function reject_class_enrollment();`);
    try {
      expect(
        await service.importStudents(teacher, {
          classId: classroom.id,
          emails: ["student@example.com"],
        }),
      ).toMatchObject({ code: "INTERNAL_ERROR" });
      expect(await repo.listMembers(teacher, classroom.id)).toHaveLength(0);
      expect(
        (await postgres.pool.query("select * from enrollments")).rows,
      ).toHaveLength(0);
    } finally {
      await postgres.database.exec(
        "drop trigger reject_class_enrollment on enrollments; drop function reject_class_enrollment()",
      );
    }
  });
  it("paginates scoped assignments with PostgreSQL microsecond timestamps", async () => {
    const classroom = await createClass();
    const firstCourse = await teachingCourse();
    const secondCourse = await teachingCourse("second-course");
    for (const course of [firstCourse, secondCourse])
      await repo.assignCourse(teacher, {
        classId: classroom.id,
        courseId: course.id,
        courseVersion: 1,
      });
    await postgres.pool.query(
      "update course_assignments set assigned_at = '2026-10-27T01:00:00.123456Z'",
    );
    const first = await repo.listAssignments(teacher, {
      classId: classroom.id,
      limit: 1,
    });
    const second = await repo.listAssignments(teacher, {
      classId: classroom.id,
      limit: 1,
      cursor: first.nextCursor!,
    });
    expect(
      new Set([...first.items, ...second.items].map((item) => item.courseId)),
    ).toEqual(new Set([firstCourse.id, secondCourse.id]));
    expect(second.nextCursor).toBeNull();
    expect(
      (await repo.listAssignments(otherTeacher, { limit: 1 })).items,
    ).toHaveLength(0);
  });
});
