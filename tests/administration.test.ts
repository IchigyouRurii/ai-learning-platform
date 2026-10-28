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
import { getMigrations } from "better-auth/db/migration";
import { createAuth } from "@/modules/platform/server/auth-config";
import { createAdministrationService } from "@/modules/platform/server/administration-service";
import { createAdministrationRepository } from "@/shared/database/administration-repository";
import { createNeonRepository } from "@/shared/database/neon-repository";
import { createSeedState } from "@/shared/database/seed";
import type { Course, Submission, User } from "@/shared/contracts";
import { createTestPostgres } from "./helpers/postgres";

const external = vi.hoisted(() => ({ repository: vi.fn() }));
vi.mock("@/shared/database", () => ({ getRepository: external.repository }));
import {
  enrollCourse,
  getLearningContext,
  recordSubmission,
} from "@/modules/platform/server/services";

let postgres: Awaited<ReturnType<typeof createTestPostgres>>;
let auth: ReturnType<typeof createAuth>;
let repo: ReturnType<typeof createAdministrationRepository>;
let courses: ReturnType<typeof createNeonRepository>;
let service: ReturnType<typeof createAdministrationService>;
const admin: User = { id: "admin-1", name: "Admin One", role: "admin" };
const secondAdmin: User = { id: "admin-2", name: "Admin Two", role: "admin" };
const teacher: User = { id: "teacher-1", name: "Teacher One", role: "teacher" };
const student: User = { id: "student-1", name: "Student One", role: "student" };
const other: User = { id: "student-2", name: "Student Two", role: "student" };
const users = [admin, secondAdmin, teacher, student, other];

beforeAll(async () => {
  postgres = await createTestPostgres();
  auth = createAuth(postgres.pool, {
    baseURL: "http://localhost:3000",
    secret: "admin-tests-only-7f72ec97300ab32244c8a201d5bc9a009b78",
  });
  await (await getMigrations(auth.options)).runMigrations();
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
  repo = createAdministrationRepository(postgres.pool);
  courses = createNeonRepository(postgres.pool);
  service = createAdministrationService(() => repo);
  external.repository.mockReturnValue(courses);
}, 30000);
beforeEach(async () => {
  await postgres.database.exec('truncate table "user" cascade');
  for (const user of users)
    await postgres.pool.query(
      'insert into "user" (id, name, email, role, "emailVerified", "createdAt", "updatedAt") values ($1,$2,$3,$4,false,$5,$5)',
      [
        user.id,
        user.name,
        `${user.id}@example.test`,
        user.role,
        "2026-10-20T12:00:00.000Z",
      ],
    );
});
afterAll(async () => {
  if (postgres) await postgres.database.close();
});

async function teachingCourse(id = "course-1") {
  const course: Course = {
    ...createSeedState().courses[0],
    id,
    ownerId: teacher.id,
    status: "draft",
  };
  await courses.insertCourse(course);
  return courses.publishCourse(id, teacher.id);
}
function submission(course: Course): Submission {
  return {
    id: "attempt-1",
    courseId: course.id,
    courseVersion: course.version,
    activityId: "ai-coding-r1",
    studentId: student.id,
    answer: "A specific example that can be checked.",
    aiFeedback: "Explain the acceptance criterion.",
    createdAt: new Date().toISOString(),
  };
}

describe("administrator boundaries", () => {
  it("rejects signed-out and ordinary users before obtaining the repository", async () => {
    const provider = vi.fn(() => repo);
    const boundary = createAdministrationService(provider);
    for (const operation of [
      boundary.getOverview,
      boundary.listUsers,
      boundary.listCourses,
    ]) {
      expect(await operation(null, {})).toMatchObject({
        ok: false,
        code: "AUTH_REQUIRED",
      });
      expect(await operation(student, {})).toMatchObject({
        ok: false,
        code: "FORBIDDEN",
      });
      expect(await operation(teacher, {})).toMatchObject({
        ok: false,
        code: "FORBIDDEN",
      });
    }
    expect(provider).not.toHaveBeenCalled();
  });
  it("rechecks the database role instead of trusting a forged or stale actor", async () => {
    await expect(
      repo.listUsers({ ...student, role: "admin" }, { limit: 20 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      repo.withdrawCourseAndAudit(
        { ...teacher, role: "admin" },
        "course-1",
        "Review",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("validates inputs, rejects injected authority and redacts unexpected errors", async () => {
    expect(
      await service.changeRole(admin, {
        userId: student.id,
        expectedRole: "student",
        role: "teacher",
        actorId: admin.id,
      } as never),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(
      await service.withdrawCourse(admin, { courseId: "x", reason: "  " }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    const broken = createAdministrationService(() => {
      throw new Error("secret-connection-details");
    });
    const result = await broken.listUsers(admin, {});
    expect(result).toMatchObject({ ok: false, code: "INTERNAL_ERROR" });
    expect(JSON.stringify(result)).not.toContain("secret-connection-details");
  });
});

describe("user directory and role changes", () => {
  it("returns only safe fields, supports search/role filters and keyset pagination", async () => {
    const first = await repo.listUsers(admin, { limit: 2 });
    const second = await repo.listUsers(admin, {
      limit: 2,
      cursor: first.nextCursor!,
    });
    const third = await repo.listUsers(admin, {
      limit: 2,
      cursor: second.nextCursor!,
    });
    const ids = [...first.items, ...second.items, ...third.items].map(
      (user) => user.id,
    );
    expect(new Set(ids).size).toBe(5);
    expect(third.nextCursor).toBeNull();
    expect(Object.keys(first.items[0]).sort()).toEqual([
      "createdAt",
      "email",
      "emailVerified",
      "id",
      "name",
      "role",
    ]);
    expect(
      (
        await repo.listUsers(admin, {
          limit: 20,
          role: "student",
          search: "Two",
        })
      ).items.map((user) => user.id),
    ).toEqual([other.id]);
    expect(
      (await repo.listUsers(admin, { limit: 20, search: "%" })).items,
    ).toHaveLength(0);
    expect(
      await service.listUsers(admin, { cursor: "not-a-cursor" }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });
  it("changes roles, revokes real Better Auth sessions and records an audit event", async () => {
    const registration = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          email: "new-learner@example.test",
          name: "New learner",
          password: "Local-only-test-password-2026!",
        }),
      }),
    );
    expect(registration.status).toBe(200);
    const cookie = registration.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const session = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    expect(session?.user.role).toBe("student");
    const result = await service.changeRole(admin, {
      userId: session!.user.id,
      expectedRole: "student",
      role: "teacher",
    });
    expect(result).toMatchObject({ ok: true, data: { role: "teacher" } });
    expect(
      await auth.api.getSession({ headers: new Headers({ cookie }) }),
    ).toBeNull();
    const audits = await postgres.pool.query(
      "select action, summary from admin_audit_events",
    );
    expect(audits.rows).toEqual([
      {
        action: "user.role_changed",
        summary: { from: "student", to: "teacher" },
      },
    ]);
  });
  it("protects the last administrator and rejects stale expected roles", async () => {
    await repo.changeRoleAndRevokeSessions(
      admin,
      secondAdmin.id,
      "admin",
      "student",
    );
    await expect(
      repo.changeRoleAndRevokeSessions(admin, admin.id, "admin", "student"),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await repo.getOverview(admin)).admins).toBe(1);
    await expect(
      repo.changeRoleAndRevokeSessions(admin, student.id, "teacher", "admin"),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      repo.changeRoleAndRevokeSessions(
        { ...secondAdmin },
        student.id,
        "student",
        "teacher",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("preserves teaching and personal-course ownership when a role is incompatible", async () => {
    await teachingCourse();
    await expect(
      repo.changeRoleAndRevokeSessions(admin, teacher.id, "teacher", "student"),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await courses.insertCourse({
      ...createSeedState().courses[0],
      id: "personal-1",
      ownerId: student.id,
      visibility: "personal",
      status: "published",
    });
    await expect(
      repo.changeRoleAndRevokeSessions(admin, student.id, "student", "teacher"),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      (await postgres.pool.query("select * from admin_audit_events")).rows,
    ).toHaveLength(0);
  });
  it("rolls back the role and session deletion if audit persistence fails", async () => {
    await postgres.pool.query(
      'insert into "session" (id, "userId", token, "expiresAt", "createdAt", "updatedAt") values ($1,$2,$3,$4,now(),now())',
      [
        "rollback-session",
        student.id,
        "test-only-session-token",
        "2030-01-01T00:00:00Z",
      ],
    );
    await postgres.database
      .exec(`create function reject_admin_audit() returns trigger language plpgsql as $$ begin raise exception 'test audit failure'; end $$;
      create trigger reject_admin_audit before insert on admin_audit_events for each row execute function reject_admin_audit();`);
    try {
      await expect(
        repo.changeRoleAndRevokeSessions(
          admin,
          student.id,
          "student",
          "teacher",
        ),
      ).rejects.toThrow();
      expect(
        (
          await postgres.pool.query('select role from "user" where id = $1', [
            student.id,
          ])
        ).rows[0].role,
      ).toBe("student");
      expect(
        (
          await postgres.pool.query(
            'select id from "session" where "userId" = $1',
            [student.id],
          )
        ).rows,
      ).toHaveLength(1);
    } finally {
      await postgres.database.exec(
        "drop trigger reject_admin_audit on admin_audit_events; drop function reject_admin_audit()",
      );
    }
  });
  it("protects classroom ownership when the classroom domain is present", async () => {
    await postgres.pool.query(
      "insert into classrooms (id, teacher_id, name) values ($1,$2,$3)",
      ["class-1", teacher.id, "Class One"],
    );
    await expect(
      repo.changeRoleAndRevokeSessions(admin, teacher.id, "teacher", "student"),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("teaching-course moderation", () => {
  it("retains historical enrollment without granting access until the student directly enrolls", async () => {
    const course = await teachingCourse();
    await postgres.pool.query(
      "insert into enrollments (course_id, student_id, direct_access) values ($1, $2, false)",
      [course.id, student.id],
    );
    expect(await courses.isEnrolled(course.id, student.id)).toBe(false);
    expect((await courses.getWorkspace(student)).enrollments).toEqual([]);
    await expect(
      getLearningContext(student, course.id, "ai-coding-r1"),
    ).rejects.toThrow("enroll");
    await expect(courses.insertSubmission(submission(course))).rejects.toThrow(
      "changed",
    );
    await expect(
      courses.insertFeedback({
        id: "history-only-feedback",
        courseId: course.id,
        studentId: student.id,
        teacherId: teacher.id,
        message: "A historical row does not grant teaching access.",
        createdAt: new Date().toISOString(),
      }),
    ).rejects.toThrow();
    expect(
      (await postgres.pool.query("select * from enrollments")).rows,
    ).toHaveLength(1);

    await enrollCourse(student, course.id);
    expect(await courses.isEnrolled(course.id, student.id)).toBe(true);
    expect((await courses.getWorkspace(student)).enrollments).toHaveLength(1);
    await courses.insertSubmission(submission(course));
  });

  it("lists teaching metadata without personal courses, lesson bodies or quiz keys", async () => {
    await teachingCourse();
    await courses.insertCourse({
      ...createSeedState().courses[0],
      id: "personal-1",
      title: "PRIVATE PERSONAL TITLE",
      ownerId: student.id,
      visibility: "personal",
      status: "published",
    });
    const result = await service.listCourses(admin, {});
    expect(result).toMatchObject({
      ok: true,
      data: { items: [{ id: "course-1", ownerName: teacher.name }] },
    });
    expect(JSON.stringify(result)).not.toContain("PRIVATE PERSONAL TITLE");
    expect(JSON.stringify(result)).not.toMatch(
      /correctOptionIds|rubric|"body"/,
    );
    expect(
      (await repo.listCourses(admin, { limit: 20, search: teacher.name }))
        .items,
    ).toHaveLength(1);
    await expect(
      repo.withdrawCourseAndAudit(admin, "personal-1", "No."),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await repo.getOverview(admin)).toMatchObject({
      users: 5,
      courses: 1,
      publishedCourses: 1,
      withdrawnCourses: 0,
    });
  });
  it("withdraws idempotently, blocks direct learning/enrollment/submissions and preserves history", async () => {
    const course = await teachingCourse();
    await courses.enroll(course.id, student.id);
    await courses.insertSubmission(submission(course));
    await courses.insertFeedback({
      id: "feedback-1",
      courseId: course.id,
      studentId: student.id,
      teacherId: teacher.id,
      message: "Keep this feedback.",
      createdAt: new Date().toISOString(),
    });
    const first = await repo.withdrawCourseAndAudit(
      admin,
      course.id,
      "Needs a content review.",
    );
    const repeated = await repo.withdrawCourseAndAudit(
      admin,
      course.id,
      "A different reason.",
    );
    expect(repeated).toEqual(first);
    expect(
      (await postgres.pool.query("select * from admin_audit_events")).rows,
    ).toHaveLength(1);
    const workspace = await courses.getWorkspace(student);
    expect(workspace.courses).toHaveLength(0);
    expect(workspace.submissions).toHaveLength(1);
    expect(workspace.feedback).toHaveLength(1);
    expect(
      (await courses.getWorkspace(teacher)).courses[0].moderationStatus,
    ).toBe("withdrawn");
    await expect(enrollCourse(other, course.id)).rejects.toThrow("not open");
    await expect(
      getLearningContext(student, course.id, "ai-coding-r1"),
    ).rejects.toThrow("withdrawn");
    await expect(recordSubmission(student, submission(course))).rejects.toThrow(
      "withdrawn",
    );
    await expect(courses.enroll(course.id, other.id)).rejects.toThrow(
      "not open",
    );
    await expect(
      courses.insertSubmission({ ...submission(course), id: "attempt-2" }),
    ).rejects.toThrow("changed");
    expect(
      (await repo.listCourses(admin, { limit: 20, moderationStatus: "active" }))
        .items,
    ).toHaveLength(0);
    expect(
      (
        await repo.listCourses(admin, {
          limit: 20,
          moderationStatus: "withdrawn",
        })
      ).items,
    ).toHaveLength(1);
    expect(await repo.getOverview(admin)).toMatchObject({
      courses: 1,
      publishedCourses: 0,
      withdrawnCourses: 1,
    });
  });
  it("keeps withdrawal in force when the author publishes a newer version", async () => {
    const course = await teachingCourse();
    await repo.withdrawCourseAndAudit(admin, course.id, "Review required.");
    const document = (await courses.getCourseDocument(course.id))!;
    await courses.updateCourseDraft(
      course.id,
      teacher.id,
      document.draftRevision,
      { ...document.content, title: "Revised course" },
    );
    await courses.publishCourse(course.id, teacher.id);
    expect((await courses.findCourse(course.id))?.version).toBe(2);
    expect((await courses.findCourse(course.id))?.moderationStatus).toBe(
      "withdrawn",
    );
    expect((await courses.getWorkspace(student)).courses).toHaveLength(0);
    expect(
      (
        await postgres.pool.query(
          "select * from course_revisions where course_id = $1",
          [course.id],
        )
      ).rows,
    ).toHaveLength(2);
  });
});
