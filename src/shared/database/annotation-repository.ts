import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type {
  AnnotationCategory,
  AnnotationStatus,
  ContentAnnotation,
  Role,
} from "@/shared/contracts";
import { createNeonRepository } from "./neon-repository";
import type { AnnotationRepository, Page } from "./extension-repositories";

type AnnotationRow = {
  id: string;
  courseId: string;
  courseVersion: number;
  lessonId: string;
  blockId: string;
  studentId: string;
  studentName: string;
  studentRole: Role;
  quote: string;
  category: AnnotationCategory;
  message: string;
  status: AnnotationStatus;
  teacherReply: string | null;
  repliedAt: Date | string | null;
  studentSeenAt: Date | string | null;
  createdAt: Date | string;
};

const annotationSelection = `
  a.id,
  a.course_id as "courseId",
  a.course_version as "courseVersion",
  a.lesson_id as "lessonId",
  a.block_id as "blockId",
  a.student_id as "studentId",
  author.name as "studentName",
  author.role as "studentRole",
  a.quote,
  a.category,
  a.message,
  a.status,
  a.teacher_reply as "teacherReply",
  a.replied_at as "repliedAt",
  a.student_seen_at as "studentSeenAt",
  a.created_at as "createdAt"
`;

const timestamp = (value: Date | string) => new Date(value).toISOString();

function annotationFromRow(row: AnnotationRow): ContentAnnotation {
  return {
    id: row.id,
    courseId: row.courseId,
    courseVersion: row.courseVersion,
    lessonId: row.lessonId,
    blockId: row.blockId,
    student: {
      id: row.studentId,
      name: row.studentName,
      role: row.studentRole,
    },
    quote: row.quote,
    category: row.category,
    message: row.message,
    status: row.status,
    teacherReply: row.teacherReply,
    repliedAt: row.repliedAt ? timestamp(row.repliedAt) : null,
    studentSeenAt: row.studentSeenAt ? timestamp(row.studentSeenAt) : null,
    createdAt: timestamp(row.createdAt),
  };
}

export function createAnnotationRepository(pool: Pool): AnnotationRepository {
  const platform = createNeonRepository(pool);
  return {
    async create(actor, input) {
      if (actor.role !== "student") return null;
      if (!(await platform.isEnrolled(input.courseId, actor.id))) return null;
      const id = randomUUID();
      const result = await pool.query<AnnotationRow>(
        `with inserted as (
          insert into content_annotations (
            id, course_id, course_version, lesson_id, block_id, student_id,
            quote, category, message, status, student_seen_at
          )
          select $1, c.id, r.version, $4, $5, $6, $7, $8, $9, 'open', now()
          from courses c
          join course_revisions r
            on r.course_id = c.id and r.version = $3
          join enrollments e
            on e.course_id = c.id and e.student_id = $6 and e.direct_access
          where c.id = $2
            and c.status = 'published'
            and c.moderation_status = 'active'
            and c.published_version = $3
            and exists (
              select 1
              from jsonb_array_elements(r.content->'lessons') lesson
              cross join lateral jsonb_array_elements(lesson->'blocks') block
              where lesson->>'id' = $4 and block->>'id' = $5
            )
          returning *
        )
        select ${annotationSelection}
        from inserted a
        join "user" author on author.id = a.student_id`,
        [
          id,
          input.courseId,
          input.courseVersion,
          input.lessonId,
          input.blockId,
          actor.id,
          input.quote ?? "",
          input.category,
          input.message,
        ],
      );
      return result.rows[0] ? annotationFromRow(result.rows[0]) : null;
    },

    async listMine(actor, reference, page) {
      if (actor.role !== "student") return null;
      if (!(await platform.isEnrolled(reference.courseId, actor.id)))
        return null;
      const result = await pool.query<AnnotationRow>(
        `select ${annotationSelection}
         from content_annotations a
         join "user" author on author.id = a.student_id
         where a.student_id = $1 and a.course_id = $2 and a.course_version = $3
         order by a.created_at desc, a.id desc
         limit $4`,
        [actor.id, reference.courseId, reference.courseVersion, page.limit],
      );
      return {
        items: result.rows.map(annotationFromRow),
        nextCursor: null,
      } satisfies Page<ContentAnnotation>;
    },

    async listForTeacher(actor, filter) {
      if (actor.role !== "teacher") return null;
      const values: unknown[] = [actor.id];
      const conditions = ["c.owner_id = $1"];
      if (filter.courseId) {
        values.push(filter.courseId);
        conditions.push(`a.course_id = $${values.length}`);
      }
      if (filter.studentId) {
        values.push(filter.studentId);
        conditions.push(`a.student_id = $${values.length}`);
      }
      values.push(filter.limit);
      const result = await pool.query<AnnotationRow>(
        `select ${annotationSelection}
         from content_annotations a
         join "user" author on author.id = a.student_id
         join courses c on c.id = a.course_id
         where ${conditions.join(" and ")}
         order by a.created_at desc, a.id desc
         limit $${values.length}`,
        values,
      );
      return {
        items: result.rows.map(annotationFromRow),
        nextCursor: null,
      } satisfies Page<ContentAnnotation>;
    },

    async reply(actor, annotationId, message) {
      if (actor.role !== "teacher") return null;
      const result = await pool.query<AnnotationRow>(
        `with updated as (
          update content_annotations a
          set teacher_reply = $3,
              status = case when a.status = 'resolved' then 'resolved'
                            else 'replied' end,
              replied_by = $2,
              replied_at = now(),
              student_seen_at = null
          from courses c
          where a.id = $1
            and c.id = a.course_id
            and c.owner_id = $2
          returning a.*
        )
        select ${annotationSelection}
        from updated a
        join "user" author on author.id = a.student_id`,
        [annotationId, actor.id, message],
      );
      return result.rows[0] ? annotationFromRow(result.rows[0]) : null;
    },

    async resolve(actor, annotationId) {
      if (actor.role !== "teacher") return null;
      const result = await pool.query<AnnotationRow>(
        `with updated as (
          update content_annotations a
          set status = 'resolved',
              replied_by = coalesce(a.replied_by, $2),
              replied_at = coalesce(a.replied_at, now()),
              student_seen_at = null
          from courses c
          where a.id = $1
            and c.id = a.course_id
            and c.owner_id = $2
          returning a.*
        )
        select ${annotationSelection}
        from updated a
        join "user" author on author.id = a.student_id`,
        [annotationId, actor.id],
      );
      return result.rows[0] ? annotationFromRow(result.rows[0]) : null;
    },

    async markSeen(actor, annotationId) {
      if (actor.role !== "student") return false;
      const updated = await pool.query(
        `update content_annotations
         set student_seen_at = now()
         where id = $1 and student_id = $2
           and status <> 'open' and student_seen_at is null
         returning id`,
        [annotationId, actor.id],
      );
      if (updated.rowCount) return true;
      const existing = await pool.query(
        `select 1 from content_annotations
         where id = $1 and student_id = $2 and status <> 'open'`,
        [annotationId, actor.id],
      );
      return Boolean(existing.rowCount);
    },
  };
}
