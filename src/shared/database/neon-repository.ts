import type { Pool } from "pg";
import {
  courseDraftSchema,
  type Course,
  type CourseDocument,
  type CourseDraft,
  type Enrollment,
  type LearningPathRecord,
  type Submission,
  type TeacherFeedback,
  type User,
} from "@/shared/contracts";
import type { PlatformRepository } from "./repository";

type CourseRow = {
  id: string;
  owner_id: string;
  status: Course["status"];
  visibility: Course["visibility"];
  version: number;
  content: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};
type CourseDocumentRow = {
  id: string;
  owner_id: string;
  status: Course["status"];
  visibility: Course["visibility"];
  version: number;
  published_version: number | null;
  draft_revision: number;
  draft_content: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};
const courseColumns = `c.id, c.owner_id, c.status, c.visibility, c.version, coalesce(r.content, c.draft_content) as content, c.created_at, c.updated_at`;
const courseFrom = `courses c left join course_revisions r on r.course_id = c.id and r.version = c.published_version`;
const timestamp = (value: string | Date) => new Date(value).toISOString();
function courseFromRow(row: CourseRow): Course {
  return {
    ...courseDraftSchema.parse(row.content),
    id: row.id,
    ownerId: row.owner_id,
    status: row.status,
    visibility: row.visibility,
    version: row.version,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  };
}
function documentFromRow(row: CourseDocumentRow): CourseDocument {
  return {
    id: row.id,
    ownerId: row.owner_id,
    status: row.status,
    visibility: row.visibility,
    version: row.version,
    publishedVersion: row.published_version,
    draftRevision: row.draft_revision,
    content: courseDraftSchema.parse(row.draft_content),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  };
}
const documentColumns = `id, owner_id, status, visibility, version, published_version, draft_revision, draft_content, created_at, updated_at`;

export function createNeonRepository(pool: Pool): PlatformRepository {
  return {
    async getWorkspace(actor) {
      const teacher = actor.role === "teacher";
      const courses = await pool.query<CourseRow>(
        teacher
          ? `select ${courseColumns} from ${courseFrom} where c.owner_id = $1 order by c.created_at desc`
          : `select ${courseColumns} from ${courseFrom} where (c.status = 'published' and c.visibility = 'cohort') or (c.owner_id = $1 and c.visibility = 'personal') order by c.created_at desc`,
        [actor.id],
      );
      const [enrollments, submissions, feedback, members] = await Promise.all([
        pool.query<Enrollment>(
          `select e.course_id as "courseId", e.student_id as "studentId", e.joined_at as "joinedAt" from enrollments e join courses c on c.id = e.course_id where ${teacher ? "c.owner_id" : "e.student_id"} = $1`,
          [actor.id],
        ),
        pool.query<Submission>(
          `select s.id, s.course_id as "courseId", s.course_version as "courseVersion", s.activity_id as "activityId", s.student_id as "studentId", s.answer, s.ai_feedback as "aiFeedback", s.created_at as "createdAt" from submissions s join courses c on c.id = s.course_id where ${teacher ? "c.owner_id" : "s.student_id"} = $1 order by s.created_at`,
          [actor.id],
        ),
        pool.query<TeacherFeedback>(
          `select f.id, f.course_id as "courseId", f.student_id as "studentId", f.teacher_id as "teacherId", f.message, f.created_at as "createdAt" from teacher_feedback f join courses c on c.id = f.course_id where ${teacher ? "c.owner_id" : "f.student_id"} = $1 order by f.created_at`,
          [actor.id],
        ),
        teacher
          ? pool.query<User>(
              `select distinct u.id, u.name, u.role from "user" u join enrollments e on e.student_id = u.id join courses c on c.id = e.course_id where c.owner_id = $1`,
              [actor.id],
            )
          : Promise.resolve({ rows: [actor] }),
      ]);
      return {
        schemaVersion: 1 as const,
        courses: courses.rows.map(courseFromRow),
        enrollments: enrollments.rows.map((item) => ({
          ...item,
          joinedAt: timestamp(item.joinedAt),
        })),
        submissions: submissions.rows.map((item) => ({
          ...item,
          createdAt: timestamp(item.createdAt),
        })),
        feedback: feedback.rows.map((item) => ({
          ...item,
          createdAt: timestamp(item.createdAt),
        })),
        members: members.rows,
      };
    },
    async findCourse(id) {
      const result = await pool.query<CourseRow>(
        `select ${courseColumns} from ${courseFrom} where c.id = $1`,
        [id],
      );
      return result.rows[0] ? courseFromRow(result.rows[0]) : null;
    },
    async getCourseDocument(id) {
      const result = await pool.query<CourseDocumentRow>(
        `select ${documentColumns} from courses where id = $1`,
        [id],
      );
      return result.rows[0] ? documentFromRow(result.rows[0]) : null;
    },
    async isEnrolled(courseId, studentId) {
      return Boolean(
        (
          await pool.query(
            "select 1 from enrollments where course_id = $1 and student_id = $2",
            [courseId, studentId],
          )
        ).rowCount,
      );
    },
    async insertCourse(course) {
      const { title, description, subject, audience, goals, lessons } = course;
      const content = {
        title,
        description,
        subject,
        audience,
        goals,
        lessons,
      };
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(
          `insert into courses (id, owner_id, status, visibility, version, draft_content, created_at, updated_at) values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
          [
            course.id,
            course.ownerId,
            course.status,
            course.visibility,
            course.version,
            JSON.stringify(content),
            course.createdAt,
            course.updatedAt,
          ],
        );
        if (
          course.visibility === "personal" &&
          course.status === "published"
        ) {
          await client.query(
            "insert into course_revisions (course_id, version, content) values ($1, $2, $3::jsonb)",
            [course.id, course.version, JSON.stringify(content)],
          );
          await client.query(
            "update courses set published_version = $2 where id = $1",
            [course.id, course.version],
          );
          await client.query(
            `insert into enrollments (course_id, student_id) values ($1, $2) on conflict do nothing`,
            [course.id, course.ownerId],
          );
        }
        await client.query("commit");
        return course;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async updateCourseDraft(
      courseId,
      ownerId,
      expectedDraftRevision,
      content: CourseDraft,
    ) {
      const result = await pool.query<CourseDocumentRow>(
        `update courses set draft_content = $4::jsonb, draft_revision = draft_revision + 1, updated_at = now() where id = $1 and owner_id = $2 and draft_revision = $3 returning ${documentColumns}`,
        [
          courseId,
          ownerId,
          expectedDraftRevision,
          JSON.stringify(courseDraftSchema.parse(content)),
        ],
      );
      if (!result.rows[0])
        throw new Error(
          "This course changed in another tab or does not belong to you. Reload and try again.",
        );
      return documentFromRow(result.rows[0]);
    },
    async publishCourse(courseId, ownerId) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await client.query<{
          id: string;
          owner_id: string;
          status: Course["status"];
          visibility: Course["visibility"];
          version: number;
          published_version: number | null;
          draft_content: unknown;
          created_at: Date | string;
          updated_at: Date | string;
        }>(
          `select id, owner_id, status, visibility, version, published_version, draft_content, created_at, updated_at from courses where id = $1 and owner_id = $2 for update`,
          [courseId, ownerId],
        );
        const row = result.rows[0];
        if (!row) throw new Error("Course not found or access denied.");
        const content = courseDraftSchema.parse(row.draft_content);
        let unchanged = false;
        if (row.status === "published" && row.published_version !== null) {
          const same = await client.query<{ same: boolean }>(
            `select content = $3::jsonb as same from course_revisions where course_id = $1 and version = $2`,
            [courseId, row.published_version, JSON.stringify(content)],
          );
          unchanged = same.rows[0]?.same === true;
        }
        const version =
          row.status === "published" ? row.version + 1 : row.version;
        if (!unchanged) {
          await client.query(
            "insert into course_revisions (course_id, version, content) values ($1, $2, $3::jsonb)",
            [courseId, version, JSON.stringify(content)],
          );
          await client.query(
            "update courses set status = 'published', version = $2, published_version = $2, updated_at = now() where id = $1 returning updated_at",
            [courseId, version],
          );
        }
        await client.query("commit");
        return {
          ...content,
          id: row.id,
          ownerId: row.owner_id,
          status: "published" as const,
          visibility: row.visibility,
          version: unchanged ? row.version : version,
          createdAt: timestamp(row.created_at),
          updatedAt: new Date().toISOString(),
        };
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async enroll(courseId, studentId) {
      const result = await pool.query(
        `insert into enrollments (course_id, student_id) select id, $2 from courses where id = $1 and status = 'published' and (visibility = 'cohort' or (visibility = 'personal' and owner_id = $2)) on conflict (course_id, student_id) do update set joined_at = enrollments.joined_at returning course_id`,
        [courseId, studentId],
      );
      if (!result.rowCount)
        throw new Error("This course is not open for enrollment.");
    },
    async insertSubmission(item) {
      const result = await pool.query(
        `insert into submissions (id, course_id, course_version, activity_id, student_id, answer, ai_feedback, created_at)
        select $1, c.id, c.version, $4, $5, $6, $7, $8 from courses c
        join enrollments e on e.course_id = c.id and e.student_id = $5
        join course_revisions r on r.course_id = c.id and r.version = c.published_version
        where c.id = $2 and c.version = $3 and c.status = 'published'
        and exists (select 1 from jsonb_array_elements(r.content->'lessons') l cross join lateral jsonb_array_elements(l->'blocks') b where b->>'type' = 'activity' and b->'activity'->>'id' = $4) returning id`,
        [
          item.id,
          item.courseId,
          item.courseVersion,
          item.activityId,
          item.studentId,
          item.answer,
          item.aiFeedback,
          item.createdAt,
        ],
      );
      if (!result.rowCount)
        throw new Error(
          "The course, activity, or enrollment has changed. Refresh and try again.",
        );
      return item;
    },
    async insertFeedback(item) {
      const result = await pool.query(
        `insert into teacher_feedback (id, course_id, student_id, teacher_id, message, created_at) select $1, c.id, e.student_id, $4, $5, $6 from courses c join enrollments e on e.course_id = c.id and e.student_id = $3 where c.id = $2 and c.owner_id = $4 returning id`,
        [
          item.id,
          item.courseId,
          item.studentId,
          item.teacherId,
          item.message,
          item.createdAt,
        ],
      );
      if (!result.rowCount)
        throw new Error("Access denied or student not enrolled.");
    },
    async getLearningPath(ownerId) {
      const result = await pool.query<{
        learning_path: LearningPathRecord | null;
      }>(
        "select learning_path from learning_profiles where user_id = $1",
        [ownerId],
      );
      const path = result.rows[0]?.learning_path;
      return path && Object.keys(path).length ? path : null;
    },
    async saveLearningPath(path) {
      await pool.query(
        `insert into learning_profiles (user_id, learning_path, updated_at) values ($1, $2::jsonb, now()) on conflict (user_id) do update set learning_path = excluded.learning_path, updated_at = now()`,
        [path.ownerId, JSON.stringify(path)],
      );
      return path;
    },
  };
}
