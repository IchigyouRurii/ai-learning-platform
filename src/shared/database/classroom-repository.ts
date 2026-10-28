import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type {
  Classroom,
  ClassroomMember,
  CourseAssignment,
  FeatureErrorCode,
  User,
} from "@/shared/contracts";
import type { ClassroomRepository, Page } from "./extension-repositories";

export class ClassroomError extends Error {
  constructor(
    public readonly code: FeatureErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ClassroomError";
  }
}
const time = (value: string | Date) => new Date(value).toISOString();
const classColumns = `c.id, c.teacher_id as "teacherId", c.name, c.description,
 c.created_at as "createdAt", u.name as "teacherName", c.status, c.archive_reason as "archiveReason",
 (select count(*)::int from classroom_members m join "user" s on s.id = m.student_id and s.role = 'student' where m.class_id = c.id) as "memberCount",
 (select count(*)::int from course_assignments a where a.class_id = c.id and a.revoked_at is null) as "assignmentCount"`;
const classFrom = `classrooms c join "user" u on u.id = c.teacher_id`;
const scoped = (actor: User) =>
  actor.role === "teacher"
    ? "c.teacher_id = $1"
    : "exists(select 1 from classroom_members m where m.class_id = c.id and m.student_id = $1)";
const classView = (row: Classroom): Classroom => ({
  ...row,
  createdAt: time(row.createdAt),
});
function cursorId(cursor?: string) {
  if (!cursor) return null;
  try {
    const id: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    if (typeof id === "string" && id.length > 0 && id.length <= 200) return id;
  } catch {
    /* Invalid cursors have a safe domain error. */
  }
  throw new ClassroomError(
    "INVALID_INPUT",
    "This page link is invalid. Return to the first page.",
  );
}
function pageOf<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  const items = rows.slice(0, limit);
  return {
    items,
    nextCursor:
      rows.length > limit && items.length
        ? Buffer.from(JSON.stringify(items.at(-1)!.id)).toString("base64url")
        : null,
  };
}

export function createClassroomRepository(pool: Pool): ClassroomRepository {
  async function transact<T>(
    actor: User,
    task: (db: PoolClient) => Promise<T>,
  ): Promise<T> {
    if (actor.role !== "teacher" && actor.role !== "student")
      throw new ClassroomError(
        "FORBIDDEN",
        "A teacher or student account is required.",
      );
    const db = await pool.connect();
    try {
      await db.query("begin");
      const current = await db.query<{ role: string }>(
        'select role from "user" where id = $1 for share',
        [actor.id],
      );
      if (current.rows[0]?.role !== actor.role)
        throw new ClassroomError(
          "FORBIDDEN",
          "Your account role has changed. Sign in again.",
        );
      const result = await task(db);
      await db.query("commit");
      return result;
    } catch (error) {
      await db.query("rollback");
      throw error;
    } finally {
      db.release();
    }
  }
  async function owned(
    db: PoolClient,
    actor: User,
    classId: string,
    allowArchived = false,
  ) {
    if (actor.role !== "teacher")
      throw new ClassroomError("FORBIDDEN", "Teacher access is required.");
    const found = await db.query<{ status: string }>(
      "select id, status from classrooms where id = $1 and teacher_id = $2 for update",
      [classId, actor.id],
    );
    if (!found.rowCount)
      throw new ClassroomError(
        "NOT_FOUND",
        "Classroom not found or access denied.",
      );
    if (!allowArchived && found.rows[0].status !== "active")
      throw new ClassroomError(
        "CONFLICT",
        "This class has been archived by an administrator. Its records remain available for viewing.",
      );
    return found.rows[0].status;
  }
  async function view(db: PoolClient, actor: User, classId: string) {
    const result = await db.query<Classroom>(
      `select ${classColumns} from ${classFrom} where c.id = $2 and ${scoped(actor)}`,
      [actor.id, classId],
    );
    return result.rows[0] ? classView(result.rows[0]) : null;
  }
  async function requireView(db: PoolClient, actor: User, classId: string) {
    const item = await view(db, actor, classId);
    if (!item)
      throw new ClassroomError(
        "NOT_FOUND",
        "Classroom not found or access denied.",
      );
    return item;
  }
  async function createHistoryEnrollments(db: PoolClient, classId: string) {
    // Records satisfy the submission FK, but never become a direct grant.
    await db.query(
      `insert into enrollments (course_id, student_id, direct_access)
      select distinct a.course_id, m.student_id, false from classroom_members m
      join course_assignments a on a.class_id = m.class_id and a.revoked_at is null
      where m.class_id = $1 on conflict do nothing`,
      [classId],
    );
  }
  const assignmentColumns = `a.id, a.class_id as "classId", a.course_id as "courseId", a.course_version as "courseVersion",
    r.content->>'title' as title, a.due_at as "dueAt", a.assigned_at as "assignedAt", c.name as "className",
    (c.status = 'archived') as "classArchived", (c.status = 'active' and course.status = 'published' and course.moderation_status = 'active') as available`;
  const assignmentFrom = `course_assignments a join classrooms c on c.id = a.class_id
    join courses course on course.id = a.course_id
    join course_revisions r on r.course_id = a.course_id and r.version = a.course_version`;
  const assignmentView = (row: CourseAssignment): CourseAssignment => ({
    ...row,
    dueAt: row.dueAt ? time(row.dueAt) : null,
    assignedAt: time(row.assignedAt),
  });
  const repo: ClassroomRepository = {
    create: (actor, input) =>
      transact(actor, async (db) => {
        if (actor.role !== "teacher")
          throw new ClassroomError("FORBIDDEN", "Teacher access is required.");
        const id = randomUUID();
        await db.query(
          "insert into classrooms (id, teacher_id, name, description) values ($1, $2, $3, $4)",
          [id, actor.id, input.name, input.description],
        );
        return requireView(db, actor, id);
      }),
    update: (actor, input) =>
      transact(actor, async (db) => {
        await owned(db, actor, input.classId);
        await db.query(
          "update classrooms set name = $3, description = $4 where id = $1 and teacher_id = $2",
          [input.classId, actor.id, input.name, input.description],
        );
        return requireView(db, actor, input.classId);
      }),
    findForActor: (actor, classId) =>
      transact(actor, (db) => view(db, actor, classId)),
    listMine: (actor, page) =>
      transact(actor, async (db) => {
        const cursor = cursorId(page.cursor);
        const result = await db.query<Classroom>(
          `select ${classColumns} from ${classFrom} where ${scoped(actor)}
        and ($2::text is null or (c.created_at, c.id) < (select created_at, id from classrooms where id = $2))
        order by c.created_at desc, c.id desc limit $3`,
          [actor.id, cursor, page.limit + 1],
        );
        return pageOf(result.rows.map(classView), page.limit);
      }),
    listMembers: (actor, classId) =>
      transact(actor, async (db) => {
        await owned(db, actor, classId, true);
        const result = await db.query<ClassroomMember>(
          `select m.class_id as "classId", m.joined_at as "joinedAt",
        jsonb_build_object('id', u.id, 'name', u.name, 'role', u.role) as student
        from classroom_members m join "user" u on u.id = m.student_id and u.role = 'student'
        where m.class_id = $1 order by m.joined_at, m.student_id`,
          [classId],
        );
        return result.rows.map((row) => ({
          ...row,
          joinedAt: time(row.joinedAt),
        }));
      }),
    saveJoinCode: (actor, classId, tokenHash, expiresAt) =>
      transact(actor, async (db) => {
        await owned(db, actor, classId);
        await db.query(
          `insert into classroom_join_codes (class_id, token_hash, expires_at) values ($1, $2, $3)
        on conflict (class_id) do update set token_hash = excluded.token_hash, expires_at = excluded.expires_at`,
          [classId, tokenHash, expiresAt],
        );
      }),
    async joinByCodeHash(actor, tokenHash) {
      // Failed attempts are committed too, so invalid codes cannot reset the limit.
      const result = await transact(actor, async (db) => {
        if (actor.role !== "student")
          throw new ClassroomError("FORBIDDEN", "Student access is required.");
        const tries = await db.query<{ attempts: number }>(
          `insert into classroom_join_attempts (student_id, attempts) values ($1, 1)
          on conflict (student_id) do update set
          attempts = case when classroom_join_attempts.window_start < now() - interval '15 minutes' then 1 else least(classroom_join_attempts.attempts + 1, 11) end,
          window_start = case when classroom_join_attempts.window_start < now() - interval '15 minutes' then now() else classroom_join_attempts.window_start end
          returning attempts`,
          [actor.id],
        );
        if (tries.rows[0].attempts > 10)
          return new ClassroomError(
            "RATE_LIMITED",
            "Too many join attempts. Try again in 15 minutes.",
          );
        const code = await db.query<{ class_id: string }>(
          "select class_id from classroom_join_codes where token_hash = $1 and expires_at > now()",
          [tokenHash],
        );
        const classId = code.rows[0]?.class_id;
        if (!classId)
          return new ClassroomError(
            "NOT_FOUND",
            "This join code is invalid or has expired.",
          );
        const classroom = await db.query<{ status: string }>(
          "select status from classrooms where id = $1 for update",
          [classId],
        );
        if (classroom.rows[0]?.status !== "active")
          return new ClassroomError(
            "NOT_FOUND",
            "This join code is invalid or the class is unavailable.",
          );
        const valid = await db.query(
          "select 1 from classroom_join_codes where class_id = $1 and token_hash = $2 and expires_at > now()",
          [classId, tokenHash],
        );
        if (!valid.rowCount)
          return new ClassroomError(
            "NOT_FOUND",
            "This join code is invalid or has expired.",
          );
        await db.query(
          "insert into classroom_members (class_id, student_id) values ($1, $2) on conflict do nothing",
          [classId, actor.id],
        );
        await createHistoryEnrollments(db, classId);
        return requireView(db, actor, classId);
      });
      if (result instanceof ClassroomError) throw result;
      return result;
    },
    importExistingStudents: (actor, classId, emails) =>
      transact(actor, async (db) => {
        await owned(db, actor, classId);
        const unique = [...new Set(emails.map((email) => email.toLowerCase()))];
        const users = await db.query<{ id: string; email: string }>(
          `select id, lower(email) as email from "user" where lower(email) = any($1::text[]) and role = 'student' order by id for share`,
          [unique],
        );
        const added: string[] = [];
        for (const user of users.rows) {
          const inserted = await db.query(
            "insert into classroom_members (class_id, student_id) values ($1, $2) on conflict do nothing returning student_id",
            [classId, user.id],
          );
          if (inserted.rowCount) added.push(user.id);
        }
        await createHistoryEnrollments(db, classId);
        return {
          added,
          missingEmails: unique.filter(
            (email) => !users.rows.some((user) => user.email === email),
          ),
        };
      }),
    removeMember: (actor, classId, studentId) =>
      transact(actor, async (db) => {
        await owned(db, actor, classId);
        const result = await db.query(
          "delete from classroom_members where class_id = $1 and student_id = $2 returning student_id",
          [classId, studentId],
        );
        return Boolean(result.rowCount);
      }),
    listAssignableCourses: (actor, classId) =>
      transact(actor, async (db) => {
        if ((await owned(db, actor, classId, true)) === "archived") return [];
        const result = await db.query<{
          id: string;
          title: string;
          versions: number[];
          publishedVersion: number;
        }>(
          `select c.id, r.content->>'title' as title, c.published_version as "publishedVersion",
        (select array_agg(v.version order by v.version desc) from course_revisions v where v.course_id = c.id) as versions
        from courses c join course_revisions r on r.course_id = c.id and r.version = c.published_version
        where c.owner_id = $1 and c.visibility = 'cohort' and c.status = 'published' and c.moderation_status = 'active' order by c.created_at desc, c.id`,
          [actor.id],
        );
        return result.rows;
      }),
    assignCourse: (actor, input) =>
      transact(actor, async (db) => {
        await owned(db, actor, input.classId);
        const course = await db.query(
          `select c.id from courses c join course_revisions r on r.course_id = c.id and r.version = $3
        where c.id = $1 and c.owner_id = $2 and c.visibility = 'cohort' and c.status = 'published' and c.moderation_status = 'active' for share of c`,
          [input.courseId, actor.id, input.courseVersion],
        );
        if (!course.rowCount)
          throw new ClassroomError(
            "NOT_FOUND",
            "Choose one of your published, active teaching-course versions.",
          );
        // Repeated requests keep the original due date; a revoked assignment may be assigned again.
        const inserted = await db.query<{ id: string }>(
          `insert into course_assignments (id, class_id, course_id, course_version, due_at) values ($1, $2, $3, $4, $5)
        on conflict (class_id, course_id, course_version) do update set
          due_at = case when course_assignments.revoked_at is not null then excluded.due_at else course_assignments.due_at end,
          assigned_at = case when course_assignments.revoked_at is not null then now() else course_assignments.assigned_at end,
          revoked_at = null returning id`,
          [
            randomUUID(),
            input.classId,
            input.courseId,
            input.courseVersion,
            input.dueAt ?? null,
          ],
        );
        await createHistoryEnrollments(db, input.classId);
        const result = await db.query<CourseAssignment>(
          `select ${assignmentColumns} from ${assignmentFrom} where a.id = $1 and c.teacher_id = $2`,
          [inserted.rows[0].id, actor.id],
        );
        return assignmentView(result.rows[0]);
      }),
    removeAssignment: (actor, classId, assignmentId) =>
      transact(actor, async (db) => {
        await owned(db, actor, classId);
        const result = await db.query(
          "update course_assignments set revoked_at = now() where id = $1 and class_id = $2 and revoked_at is null returning id",
          [assignmentId, classId],
        );
        return Boolean(result.rowCount);
      }),
    listAssignments: (actor, page) =>
      transact(actor, async (db) => {
        if (page.classId) await requireView(db, actor, page.classId);
        const cursor = cursorId(page.cursor);
        const result = await db.query<CourseAssignment>(
          `select ${assignmentColumns} from ${assignmentFrom}
        where ${scoped(actor)} and a.revoked_at is null and ($2::text is null or a.class_id = $2)
        and ($3::text is null or (a.assigned_at, a.id) < (select assigned_at, id from course_assignments where id = $3))
        order by a.assigned_at desc, a.id desc limit $4`,
          [actor.id, page.classId ?? null, cursor, page.limit + 1],
        );
        return pageOf(result.rows.map(assignmentView), page.limit);
      }),
    async insertInvitations() {
      throw new ClassroomError(
        "NOT_IMPLEMENTED",
        "Email invitations are not connected. Use a join code or import existing students.",
      );
    },
    async consumeInvitation() {
      throw new ClassroomError(
        "NOT_IMPLEMENTED",
        "Email invitations are not connected. Ask your teacher for a join code.",
      );
    },
  };
  return repo;
}
