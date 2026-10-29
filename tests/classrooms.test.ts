import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { User } from "@/shared/contracts";
import { createClassroomService } from "@/modules/platform/server/extensions/classrooms";
import { createNeonClassroomRepository } from "@/shared/database/classroom-repository";
import { createTestPostgres } from "./helpers/postgres";

let postgres: Awaited<ReturnType<typeof createTestPostgres>>;
let service: ReturnType<typeof createClassroomService>;

const teacher: User = { id: "teacher-1", name: "Teacher One", role: "teacher" };
const otherTeacher: User = {
  id: "teacher-2",
  name: "Teacher Two",
  role: "teacher",
};
const student: User = { id: "student-1", name: "Student One", role: "student" };
const otherStudent: User = {
  id: "student-2",
  name: "Student Two",
  role: "student",
};
const users = [
  { ...teacher, email: "teacher1@example.com" },
  { ...otherTeacher, email: "teacher2@example.com" },
  { ...student, email: "student1@example.com" },
  { ...otherStudent, email: "student2@example.com" },
];
const migrations = [
  "202610170001_neon.sql",
  "202610220001_course_editing.sql",
  "202610250001_ai_history.sql",
  "202610270001_administration.sql",
  "202610270002_classrooms.sql",
  "202610270003_admin_classrooms.sql",
];

beforeAll(async () => {
  postgres = await createTestPostgres();
  await postgres.database.exec(
    'create table "user" (id text primary key, name text not null, email text not null unique, role text not null)',
  );
  for (const name of migrations)
    await postgres.database.exec(
      await readFile(
        new URL(`../database/migrations/${name}`, import.meta.url),
        "utf8",
      ),
    );
  service = createClassroomService(() =>
    createNeonClassroomRepository(postgres.pool),
  );
}, 30000);

beforeEach(async () => {
  await postgres.database.exec(
    'truncate table classroom_members, classrooms, submissions, teacher_feedback, enrollments, course_revisions, courses, learning_profiles, generation_jobs, "user" cascade',
  );
  for (const user of users)
    await postgres.pool.query(
      'insert into "user" (id, name, email, role) values ($1, $2, $3, $4)',
      [user.id, user.name, user.email, user.role],
    );
  await seedCourse(teacher.id, "course-1", "Published Cohort Course");
  await seedCourse(otherTeacher.id, "course-2", "Other Teacher Course");
  await seedCourse(teacher.id, "course-draft", "Draft Course", "draft");
  await seedCourse(
    teacher.id,
    "course-personal",
    "Personal Course",
    "published",
    "personal",
  );
});

afterAll(async () => {
  if (postgres) await postgres.database.close();
});

async function seedCourse(
  ownerId: string,
  id: string,
  title: string,
  status: "draft" | "published" = "published",
  visibility: "cohort" | "personal" = "cohort",
) {
  const content = JSON.stringify({
    title,
    description: "",
    subject: "CS",
    audience: "Students",
    goals: [],
    lessons: [],
  });
  await postgres.pool.query(
    `insert into courses (id, owner_id, status, visibility, version, draft_content)
     values ($1, $2, 'draft', $3, 1, $4::jsonb)`,
    [id, ownerId, visibility, content],
  );
  if (status === "published") {
    await postgres.pool.query(
      "insert into course_revisions (course_id, version, content) values ($1, 1, $2::jsonb)",
      [id, content],
    );
    await postgres.pool.query(
      "update courses set status = 'published', published_version = 1 where id = $1",
      [id],
    );
  }
}

async function createClass(
  overrides: Partial<{
    name: string;
    description: string;
    courseId: string;
    studentIds: string[];
  }> = {},
) {
  const result = await service.create(teacher, {
    name: "Class A",
    description: "",
    courseId: "course-1",
    studentIds: [],
    ...overrides,
  });
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

async function enrollmentIds(courseId: string) {
  const result = await postgres.pool.query<{ student_id: string }>(
    "select student_id from enrollments where course_id = $1 order by student_id",
    [courseId],
  );
  return result.rows.map((row) => row.student_id);
}

async function directAccess(courseId: string, studentId: string) {
  const result = await postgres.pool.query<{ direct_access: boolean }>(
    "select direct_access from enrollments where course_id = $1 and student_id = $2",
    [courseId, studentId],
  );
  return result.rows[0]?.direct_access;
}

async function rowCount(table: string) {
  const result = await postgres.pool.query<{ count: number }>(
    `select count(*)::int as count from ${table}`,
  );
  return Number(result.rows[0].count);
}

describe("classroom roster service", () => {
  it("creates classes bound to a published course and scopes them to the owner", async () => {
    const classroom = await createClass();
    expect(classroom.memberCount).toBe(0);
    expect(classroom.teacherId).toBe(teacher.id);
    expect(classroom.courseId).toBe("course-1");
    expect(classroom.courseTitle).toBe("Published Cohort Course");

    const mine = await service.listMine(teacher, { limit: 20 });
    expect(mine.ok && mine.data.items).toEqual([classroom]);

    const other = await service.listMine(otherTeacher, { limit: 20 });
    expect(other.ok && other.data.items).toHaveLength(0);

    expect(
      await service.create(student, {
        name: "Forged",
        description: "",
        courseId: "course-1",
      }),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(
      await service.get(otherTeacher, { classId: classroom.id }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("rejects draft, personal, other-teacher and unknown courses", async () => {
    for (const courseId of [
      "course-draft",
      "course-personal",
      "course-2",
      "missing",
    ]) {
      expect(
        await service.create(teacher, {
          name: "Invalid",
          description: "",
          courseId,
        }),
      ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    }
    expect(await rowCount("classrooms")).toBe(0);
  });

  it("creates a class with selected students and enrolls them in the course", async () => {
    const classroom = await createClass({
      studentIds: [student.id, otherStudent.id],
    });
    expect(classroom.memberCount).toBe(2);

    const members = await service.listMembers(teacher, {
      classId: classroom.id,
    });
    expect(members.ok && members.data.map((item) => item.student.id)).toEqual([
      student.id,
      otherStudent.id,
    ]);
    expect(await enrollmentIds("course-1")).toEqual([student.id, otherStudent.id]);

    const mine = await service.listMine(student, { limit: 20 });
    expect(mine.ok && mine.data.items[0]).toMatchObject({
      id: classroom.id,
      courseId: "course-1",
      courseTitle: "Published Cohort Course",
    });
    expect(await service.get(student, { classId: classroom.id })).toMatchObject({
      ok: true,
      data: { courseTitle: "Published Cohort Course" },
    });
  });

  it("rejects invalid student selections atomically", async () => {
    expect(
      await service.create(teacher, {
        name: "Invalid students",
        description: "",
        courseId: "course-1",
        studentIds: [student.id, "missing"],
      }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(
      await service.create(teacher, {
        name: "Teacher selected",
        description: "",
        courseId: "course-1",
        studentIds: [otherTeacher.id],
      }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });

    expect(await rowCount("classrooms")).toBe(0);
    expect(await rowCount("classroom_members")).toBe(0);
    expect(await rowCount("enrollments")).toBe(0);
  });

  it("deduplicates repeated student IDs", async () => {
    const classroom = await createClass({
      studentIds: [student.id, student.id],
    });
    expect(classroom.memberCount).toBe(1);
    expect(await enrollmentIds("course-1")).toEqual([student.id]);
  });

  it("lists only registered students and imports selected emails", async () => {
    const classroom = await createClass();
    const directory = await service.listStudents(teacher, {
      search: "",
      limit: 200,
    });
    expect(directory.ok).toBe(true);
    if (!directory.ok) throw new Error(directory.error);
    expect(directory.data.items.map((item) => item.email).sort()).toEqual([
      "student1@example.com",
      "student2@example.com",
    ]);

    const imported = await service.importStudents(teacher, {
      classId: classroom.id,
      emails: [
        "student1@example.com",
        "Teacher1@Example.com",
        "missing@example.com",
      ],
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error(imported.error);
    expect(imported.data.added).toEqual([student.id]);
    expect(imported.data.missingEmails.sort()).toEqual([
      "missing@example.com",
      "teacher1@example.com",
    ]);
    expect(await enrollmentIds("course-1")).toEqual([student.id]);

    const members = await service.listMembers(teacher, {
      classId: classroom.id,
    });
    expect(members.ok).toBe(true);
    if (!members.ok) throw new Error(members.error);
    expect(members.data[0].student).toMatchObject({
      id: student.id,
      email: "student1@example.com",
    });

    const again = await service.importStudents(teacher, {
      classId: classroom.id,
      emails: ["student1@example.com"],
    });
    expect(again).toMatchObject({ ok: true, data: { added: [] } });
    expect(await enrollmentIds("course-1")).toEqual([student.id]);

    const moved = await service.listMine(student, { limit: 20 });
    expect(moved.ok && moved.data.items.map((item) => item.id)).toEqual([
      classroom.id,
    ]);
    expect(await service.get(student, { classId: classroom.id })).toMatchObject(
      { ok: true },
    );
    expect(
      await service.get(otherStudent, { classId: classroom.id }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("removes members only for the owning teacher and keeps enrollment", async () => {
    const classroom = await createClass({
      studentIds: [student.id, otherStudent.id],
    });

    expect(
      await service.removeMember(otherTeacher, {
        classId: classroom.id,
        studentId: student.id,
      }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });

    expect(
      await service.removeMember(teacher, {
        classId: classroom.id,
        studentId: student.id,
      }),
    ).toMatchObject({ ok: true, data: { removed: true } });
    expect(
      await service.removeMember(teacher, {
        classId: classroom.id,
        studentId: student.id,
      }),
    ).toMatchObject({ ok: true, data: { removed: false } });

    const members = await service.listMembers(teacher, {
      classId: classroom.id,
    });
    expect(members.ok && members.data.map((item) => item.student.id)).toEqual([
      otherStudent.id,
    ]);
    expect(await enrollmentIds("course-1")).toEqual([
      student.id,
      otherStudent.id,
    ]);
    expect(await directAccess("course-1", student.id)).toBe(false);
    expect(await directAccess("course-1", otherStudent.id)).toBe(true);
  });

  it("keeps access through another active class and restores it when re-added", async () => {
    const first = await createClass({
      name: "First",
      studentIds: [student.id],
    });
    const second = await createClass({
      name: "Second",
      studentIds: [student.id],
    });

    await service.removeMember(teacher, {
      classId: first.id,
      studentId: student.id,
    });
    expect(await directAccess("course-1", student.id)).toBe(true);

    await service.removeMember(teacher, {
      classId: second.id,
      studentId: student.id,
    });
    expect(await directAccess("course-1", student.id)).toBe(false);

    const readded = await service.importStudents(teacher, {
      classId: first.id,
      emails: ["student1@example.com"],
    });
    expect(readded).toMatchObject({
      ok: true,
      data: { added: [student.id] },
    });
    expect(await directAccess("course-1", student.id)).toBe(true);
  });

  it("deletes a class only for the owning teacher and keeps enrollment", async () => {
    const classroom = await createClass({ studentIds: [student.id] });

    expect(
      await service.deleteClass(otherTeacher, { classId: classroom.id }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await service.deleteClass(student, { classId: classroom.id }))
      .toMatchObject({ ok: false, code: "FORBIDDEN" });

    expect(
      await service.deleteClass(teacher, { classId: classroom.id }),
    ).toMatchObject({ ok: true, data: { deleted: true } });
    expect(await rowCount("classrooms")).toBe(0);
    expect(await rowCount("classroom_members")).toBe(0);
    expect(await enrollmentIds("course-1")).toEqual([student.id]);
    expect(await service.get(student, { classId: classroom.id })).toMatchObject(
      { ok: false, code: "NOT_FOUND" },
    );
    expect(
      await service.deleteClass(teacher, { classId: classroom.id }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("filters the student directory and paginates class lists", async () => {
    await createClass({ name: "First" });
    await createClass({ name: "Second" });
    await createClass({ name: "Third" });

    const counts = await service.listMine(teacher, { limit: 2 });
    expect(counts.ok && counts.data.items).toHaveLength(2);
    expect(counts.ok && counts.data.nextCursor).toBe("2");
    if (!counts.ok || !counts.data.nextCursor)
      throw new Error("Expected a next page.");
    const next = await service.listMine(teacher, {
      limit: 2,
      cursor: counts.data.nextCursor,
    });
    expect(next.ok && next.data.items).toHaveLength(1);

    const filtered = await service.listStudents(teacher, {
      search: "two",
      limit: 200,
    });
    expect(filtered.ok && filtered.data.items.map((item) => item.id)).toEqual([
      otherStudent.id,
    ]);
    const byEmail = await service.listStudents(teacher, {
      search: "student1@",
      limit: 200,
    });
    expect(byEmail.ok && byEmail.data.items.map((item) => item.id)).toEqual([
      student.id,
    ]);
  });

  it("requires a session, roles and valid input", async () => {
    expect(
      await service.create(null, {
        name: "Class",
        description: "",
        courseId: "course-1",
      }),
    ).toMatchObject({ ok: false, code: "AUTH_REQUIRED" });
    expect(
      await service.create(teacher, {
        name: "",
        description: "",
        courseId: "course-1",
      }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(
      await service.create(teacher, {
        name: "Class",
        description: "",
        courseId: "course-1",
        studentIds: Array(501).fill(student.id),
      }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(
      await service.listMine(teacher, { limit: 20, cursor: "not-a-page" }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(await service.listStudents(student, {})).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
    expect(
      await service.listMembers(student, { classId: "missing" }),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});
