import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type {
  Classroom,
  ClassroomMember,
  Role,
  StudentDirectoryEntry,
} from "@/shared/contracts";
import type {
  ClassroomRosterRepository,
  Page,
  StudentDirectoryPageInput,
  PageInput,
} from "./extension-repositories";

type ClassroomRow = {
  id: string;
  teacher_id: string;
  course_id: string;
  course_title: string;
  name: string;
  description: string;
  created_at: Date | string;
  member_count: number | string;
};
type MemberRow = {
  class_id: string;
  id: string;
  name: string;
  role: Role;
  email: string;
  joined_at: Date | string;
};

const classroomFrom = `classrooms c
  join courses co on co.id = c.course_id and co.owner_id = c.teacher_id
  left join course_revisions cr
    on cr.course_id = co.id and cr.version = co.published_version`;

const classroomColumns = `c.id, c.teacher_id, c.course_id,
  coalesce(cr.content->>'title', co.draft_content->>'title', '') as course_title,
  c.name, c.description, c.created_at,
  (select count(*)::int from classroom_members m where m.class_id = c.id) as member_count`;

const timestamp = (value: string | Date) => new Date(value).toISOString();

function classroomFromRow(row: ClassroomRow): Classroom {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    courseId: row.course_id,
    courseTitle: row.course_title,
    name: row.name,
    description: row.description,
    memberCount: Number(row.member_count),
    createdAt: timestamp(row.created_at),
  };
}

function offsetFromCursor(cursor?: string): number {
  if (!cursor) return 0;
  const offset = Number(cursor);
  if (!Number.isSafeInteger(offset) || offset < 0)
    throw new Error("Invalid page cursor.");
  return offset;
}

function pageResult<T>(rows: T[], limit: number, offset: number) {
  return {
    items: rows.slice(0, limit),
    nextCursor: rows.length > limit ? String(offset + limit) : null,
  } satisfies Page<T>;
}

export function createNeonClassroomRepository(
  pool: Pool,
): ClassroomRosterRepository {
  return {
    async create(actor, input) {
      const studentIds = [...new Set(input.studentIds)];
      const client = await pool.connect();
      try {
        await client.query("begin");
        const course = await client.query<{ id: string }>(
          `select c.id from courses c
           join "user" u on u.id = $1 and u.role = 'teacher'
           where c.id = $2 and c.owner_id = $1
             and c.status = 'published' and c.visibility = 'cohort'
           for share of c`,
          [actor.id, input.courseId],
        );
        if (!course.rowCount) {
          await client.query("rollback");
          return null;
        }
        if (studentIds.length) {
          const valid = await client.query<{ id: string }>(
            `select id from "user"
             where role = 'student' and id = any($1::text[])`,
            [studentIds],
          );
          if (valid.rows.length !== studentIds.length) {
            await client.query("rollback");
            return null;
          }
        }
        const inserted = await client.query<{ id: string }>(
          `insert into classrooms (id, teacher_id, name, description, course_id)
           values ($1, $2, $3, $4, $5) returning id`,
          [
            randomUUID(),
            actor.id,
            input.name,
            input.description,
            input.courseId,
          ],
        );
        const classId = inserted.rows[0].id;
        if (studentIds.length) {
          await client.query(
            `insert into classroom_members (class_id, student_id)
             select $1, unnest($2::text[])
             on conflict (class_id, student_id) do nothing`,
            [classId, studentIds],
          );
          await client.query(
            `insert into enrollments (course_id, student_id)
             select $1, unnest($2::text[])
             on conflict (course_id, student_id) do nothing`,
            [input.courseId, studentIds],
          );
        }
        const result = await client.query<ClassroomRow>(
          `select ${classroomColumns} from ${classroomFrom} where c.id = $1`,
          [classId],
        );
        await client.query("commit");
        return result.rows[0] ? classroomFromRow(result.rows[0]) : null;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async findForActor(actor, classId) {
      const result = await pool.query<ClassroomRow>(
        actor.role === "teacher"
          ? `select ${classroomColumns} from ${classroomFrom}
             where c.id = $1 and c.teacher_id = $2`
          : `select ${classroomColumns} from ${classroomFrom}
             join classroom_members cm on cm.class_id = c.id and cm.student_id = $2
             where c.id = $1`,
        [classId, actor.id],
      );
      return result.rows[0] ? classroomFromRow(result.rows[0]) : null;
    },
    async deleteClass(actor, classId) {
      // The shared schema has no ON DELETE CASCADE from join codes,
      // assignments or members to classrooms. Remove those links first, but
      // keep enrollments and learning records for history.
      const client = await pool.connect();
      try {
        await client.query("begin");
        const owned = await client.query<{ id: string }>(
          "select id from classrooms where id = $1 and teacher_id = $2 for update",
          [classId, actor.id],
        );
        if (!owned.rowCount) {
          await client.query("rollback");
          return false;
        }
        await client.query(
          "delete from classroom_join_codes where class_id = $1",
          [classId],
        );
        await client.query(
          "delete from course_assignments where class_id = $1",
          [classId],
        );
        await client.query(
          "delete from classroom_members where class_id = $1",
          [classId],
        );
        await client.query(
          "delete from classrooms where id = $1 and teacher_id = $2",
          [classId, actor.id],
        );
        await client.query("commit");
        return true;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async listMine(actor, page: PageInput) {
      const offset = offsetFromCursor(page.cursor);
      const result = await pool.query<ClassroomRow>(
        actor.role === "teacher"
          ? `select ${classroomColumns} from ${classroomFrom}
             where c.teacher_id = $1
             order by c.created_at desc, c.id desc limit $2 offset $3`
          : `select ${classroomColumns} from ${classroomFrom}
             join classroom_members cm on cm.class_id = c.id and cm.student_id = $1
             order by c.created_at desc, c.id desc limit $2 offset $3`,
        [actor.id, page.limit + 1, offset],
      );
      return pageResult(
        result.rows.map(classroomFromRow),
        page.limit,
        offset,
      );
    },
    async listMembers(actor, classId) {
      const result = await pool.query<MemberRow>(
        `select m.class_id, u.id, u.name, u.role, u.email, m.joined_at
         from classroom_members m
         join classrooms c on c.id = m.class_id
         join "user" u on u.id = m.student_id
         where m.class_id = $1 and c.teacher_id = $2
         order by m.joined_at, u.name`,
        [classId, actor.id],
      );
      return result.rows.map(
        (row): ClassroomMember => ({
          classId: row.class_id,
          student: {
            id: row.id,
            name: row.name,
            role: row.role,
            email: row.email,
          },
          joinedAt: timestamp(row.joined_at),
        }),
      );
    },
    async listStudents(actor, page: StudentDirectoryPageInput) {
      const offset = offsetFromCursor(page.cursor);
      const search = page.search.trim();
      const result = await pool.query<StudentDirectoryEntry>(
        `select id, name, email from "user"
         where role = 'student' and (
           $1 = '' or name ilike '%' || $1 || '%' or email ilike '%' || $1 || '%'
         )
         order by name, id limit $2 offset $3`,
        [search, page.limit + 1, offset],
      );
      return pageResult(result.rows, page.limit, offset);
    },
    async importExistingStudents(actor, classId, emails) {
      const normalized = [...new Set(emails.map((item) => item.trim().toLowerCase()))];
      const client = await pool.connect();
      try {
        await client.query("begin");
        const owned = await client.query<{ course_id: string }>(
          "select course_id from classrooms where id = $1 and teacher_id = $2 for update",
          [classId, actor.id],
        );
        if (!owned.rowCount) {
          await client.query("rollback");
          throw new Error("Class not found or access denied.");
        }
        const courseId = owned.rows[0].course_id;
        const matched = await client.query<{ id: string; email: string }>(
          `select id, lower(email) as email from "user"
           where role = 'student' and lower(email) = any($1::text[])`,
          [normalized],
        );
        const ids = matched.rows.map((row) => row.id);
        let added: string[] = [];
        if (ids.length) {
          const inserted = await client.query<{ student_id: string }>(
            `insert into classroom_members (class_id, student_id)
             select $1, unnest($2::text[])
             on conflict (class_id, student_id) do nothing
             returning student_id`,
            [classId, ids],
          );
          added = inserted.rows.map((row) => row.student_id);
          await client.query(
            `insert into enrollments (course_id, student_id)
             select $1, unnest($2::text[])
             on conflict (course_id, student_id) do nothing`,
            [courseId, ids],
          );
        }
        const matchedEmails = new Set(matched.rows.map((row) => row.email));
        const missingEmails = normalized.filter(
          (email) => !matchedEmails.has(email),
        );
        await client.query("commit");
        return { added, missingEmails };
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async removeMember(actor, classId, studentId) {
      // The course is a public cohort course. Removing class membership does not
      // revoke the student's existing enrollment or learning records.
      const result = await pool.query(
        `delete from classroom_members m using classrooms c
         where m.class_id = $1 and m.student_id = $2
         and c.id = m.class_id and c.teacher_id = $3
         returning m.student_id`,
        [classId, studentId, actor.id],
      );
      return Boolean(result.rowCount);
    },
  };
}
