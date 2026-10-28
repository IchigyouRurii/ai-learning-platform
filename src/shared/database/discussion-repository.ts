import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type {
  CourseQuestion,
  QuestionReply,
  QuestionThread,
  Role,
  User,
} from "@/shared/contracts";
import type { DiscussionRepository, Page } from "./extension-repositories";
import { createNeonRepository } from "./neon-repository";

type QuestionRow = {
  id: string;
  courseId: string;
  courseVersion: number;
  lessonId: string | null;
  studentId: string;
  studentName: string;
  studentRole: Role;
  message: string;
  status: "open" | "resolved";
  createdAt: Date | string;
};

type ReplyRow = {
  id: string;
  questionId: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  message: string;
  createdAt: Date | string;
};

const questionSelection = `
  q.id,
  q.course_id as "courseId",
  q.course_version as "courseVersion",
  q.lesson_id as "lessonId",
  q.student_id as "studentId",
  author.name as "studentName",
  author.role as "studentRole",
  q.message,
  q.status,
  q.created_at as "createdAt"
`;

const replySelection = `
  r.id,
  r.question_id as "questionId",
  r.author_id as "authorId",
  author.name as "authorName",
  author.role as "authorRole",
  r.message,
  r.created_at as "createdAt"
`;

const timestamp = (value: Date | string) => new Date(value).toISOString();

function questionFromRow(row: QuestionRow): CourseQuestion {
  return {
    id: row.id,
    courseId: row.courseId,
    courseVersion: row.courseVersion,
    lessonId: row.lessonId,
    author: {
      id: row.studentId,
      name: row.studentName,
      role: row.studentRole,
    },
    message: row.message,
    status: row.status,
    createdAt: timestamp(row.createdAt),
  };
}

function replyFromRow(row: ReplyRow): QuestionReply {
  return {
    id: row.id,
    questionId: row.questionId,
    author: {
      id: row.authorId,
      name: row.authorName,
      role: row.authorRole,
    },
    message: row.message,
    createdAt: timestamp(row.createdAt),
  };
}

async function canViewCourse(
  pool: Pool,
  platform: ReturnType<typeof createNeonRepository>,
  actor: User,
  courseId: string,
): Promise<boolean> {
  if (actor.role === "teacher") {
    const result = await pool.query(
      "select 1 from courses where id = $1 and owner_id = $2",
      [courseId, actor.id],
    );
    return Boolean(result.rowCount);
  }
  if (actor.role === "student")
    return platform.isEnrolled(courseId, actor.id);
  return false;
}

function parseCursor(
  cursor: string | undefined,
): { createdAt: string; id: string } | null {
  if (!cursor) return null;
  const separator = cursor.indexOf("|");
  if (separator <= 0 || separator === cursor.length - 1) return null;
  const createdAt = cursor.slice(0, separator);
  const id = cursor.slice(separator + 1);
  if (Number.isNaN(Date.parse(createdAt))) return null;
  return { createdAt, id };
}

export function createDiscussionRepository(pool: Pool): DiscussionRepository {
  const platform = createNeonRepository(pool);
  return {
    async insertQuestion(actor, input) {
      if (actor.role !== "student") return null;
      if (!(await platform.isEnrolled(input.courseId, actor.id))) return null;
      const id = randomUUID();
      const result = await pool.query<QuestionRow>(
        `with inserted as (
          insert into discussion_questions (
            id, course_id, course_version, lesson_id, student_id, message
          )
          select $1, c.id, c.published_version, $4, $5, $6
          from courses c
          join enrollments e
            on e.course_id = c.id and e.student_id = $5
          where c.id = $2
            and c.status = 'published'
            and c.moderation_status = 'active'
            and c.published_version = $3
            and (
              $4::text is null
              or exists (
                select 1
                from course_revisions r
                cross join lateral jsonb_array_elements(r.content->'lessons') as lesson
                where r.course_id = c.id
                  and r.version = c.published_version
                  and lesson->>'id' = $4
              )
            )
          returning *
        )
        select ${questionSelection}
        from inserted q
        join "user" author on author.id = q.student_id`,
        [
          id,
          input.courseId,
          input.courseVersion,
          input.lessonId ?? null,
          actor.id,
          input.message,
        ],
      );
      return result.rows[0] ? questionFromRow(result.rows[0]) : null;
    },

    async listThreads(actor, courseId, page, studentId) {
      if (!(await canViewCourse(pool, platform, actor, courseId))) return null;

      const values: unknown[] = [actor.id, courseId];
      const conditions = ["q.course_id = $2"];
      let from = `from discussion_questions q
        join "user" author on author.id = q.student_id
        join courses c on c.id = q.course_id`;
      if (actor.role === "teacher") {
        conditions.push("c.owner_id = $1");
        if (studentId) {
          values.push(studentId);
          conditions.push(`q.student_id = $${values.length}`);
        }
      } else {
        from = `from discussion_questions q
          join "user" author on author.id = q.student_id
          join enrollments e
            on e.course_id = q.course_id and e.student_id = $1`;
      }

      const cursor = parseCursor(page.cursor);
      if (cursor) {
        values.push(cursor.createdAt, cursor.id);
        conditions.push(
          `(q.created_at, q.id) < ($${values.length - 1}::timestamptz, $${values.length}::text)`,
        );
      }
      values.push(page.limit + 1);

      const result = await pool.query<QuestionRow>(
        `select ${questionSelection}
        ${from}
        where ${conditions.join(" and ")}
        order by q.created_at desc, q.id desc
        limit $${values.length}`,
        values,
      );
      const items = result.rows
        .slice(0, page.limit)
        .map((row) => questionFromRow(row));
      return {
        items,
        nextCursor:
          result.rows.length > page.limit && items.length
            ? `${items[items.length - 1].createdAt}|${items[items.length - 1].id}`
            : null,
      } satisfies Page<CourseQuestion>;
    },

    async getThread(actor, questionId) {
      const result = await pool.query<QuestionRow>(
        `select ${questionSelection}
        from discussion_questions q
        join "user" author on author.id = q.student_id
        where q.id = $1`,
        [questionId],
      );
      const row = result.rows[0];
      if (!row) return null;
      if (actor.role === "teacher") {
        const owner = await pool.query(
          "select 1 from courses where id = $1 and owner_id = $2",
          [row.courseId, actor.id],
        );
        if (!owner.rowCount) return null;
      } else if (actor.role === "student") {
        if (!(await platform.isEnrolled(row.courseId, actor.id))) return null;
      } else return null;
      const replies = await pool.query<ReplyRow>(
        `select ${replySelection}
        from discussion_replies r
        join "user" author on author.id = r.author_id
        where r.question_id = $1
        order by r.created_at asc, r.id asc`,
        [questionId],
      );
      return {
        question: questionFromRow(row),
        replies: replies.rows.map(replyFromRow),
      } satisfies QuestionThread;
    },

    async insertReply(actor, questionId, message) {
      if (actor.role !== "teacher" && actor.role !== "student") return null;
      const question = await pool.query<{
        courseId: string;
        courseVersion: number;
      }>(
        `select course_id as "courseId", course_version as "courseVersion"
         from discussion_questions where id = $1`,
        [questionId],
      );
      const targetQuestion = question.rows[0];
      if (!targetQuestion) return null;
      if (actor.role === "teacher") {
        const owner = await pool.query(
          "select 1 from courses where id = $1 and owner_id = $2",
          [targetQuestion.courseId, actor.id],
        );
        if (!owner.rowCount) return null;
      } else if (
        !(await platform.isEnrolled(targetQuestion.courseId, actor.id))
      )
        return null;
      const id = randomUUID();
      const target =
        actor.role === "teacher"
          ? `select q.id
             from discussion_questions q
             join courses c on c.id = q.course_id
             where q.id = $1 and c.owner_id = $2`
          : `select q.id from discussion_questions q where q.id = $1`;
      const result = await pool.query<ReplyRow>(
        `with target as (
          ${target}
        ), inserted as (
          insert into discussion_replies (
            id, question_id, author_id, author_role, message
          )
          select $3, target.id, $2, $4, $5 from target
          returning *
        )
        select ${replySelection}
        from inserted r
        join "user" author on author.id = r.author_id`,
        [questionId, actor.id, id, actor.role, message],
      );
      return result.rows[0] ? replyFromRow(result.rows[0]) : null;
    },

    async resolve(actor, questionId) {
      if (actor.role !== "teacher" && actor.role !== "student") return null;
      const result = await pool.query<QuestionRow>(
        `with updated as (
          update discussion_questions q
          set status = 'resolved'
          from courses c
          where q.id = $1
            and c.id = q.course_id
            and (q.student_id = $2 or c.owner_id = $2)
          returning q.*
        )
        select ${questionSelection}
        from updated q
        join "user" author on author.id = q.student_id`,
        [questionId, actor.id],
      );
      return result.rows[0] ? questionFromRow(result.rows[0]) : null;
    },
  };
}
