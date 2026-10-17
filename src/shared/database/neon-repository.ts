import type { Pool } from "pg";
import {
  courseDraftSchema,
  type Course,
  type Enrollment,
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

export function createNeonRepository(pool: Pool): PlatformRepository {
  return {
    async getWorkspace(actor) {
      const teacher = actor.role === "teacher";
      const courses = await pool.query<CourseRow>(
        `select ${courseColumns} from ${courseFrom} where ${teacher ? "c.owner_id = $1" : "c.status = 'published' and c.visibility = 'cohort'"} order by c.created_at desc`,
        teacher ? [actor.id] : [],
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
      await pool.query(
        `insert into courses (id, owner_id, status, visibility, version, draft_content, created_at, updated_at) values ($1, $2, 'draft', $3, $4, $5::jsonb, $6, $7)`,
        [
          course.id,
          course.ownerId,
          course.visibility,
          course.version,
          JSON.stringify({
            title,
            description,
            subject,
            audience,
            goals,
            lessons,
          }),
          course.createdAt,
          course.updatedAt,
        ],
      );
      return course;
    },
    async publishCourse(courseId, ownerId) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await client.query<CourseRow>(
          `select c.id, c.owner_id, c.status, c.visibility, c.version, c.draft_content as content, c.created_at, c.updated_at from courses c where c.id = $1 and c.owner_id = $2 for update`,
          [courseId, ownerId],
        );
        const row = result.rows[0];
        if (!row) throw new Error("课程不存在或没有管理权限。");
        if (row.status !== "published") {
          courseDraftSchema.parse(row.content);
          await client.query(
            "insert into course_revisions (course_id, version, content) values ($1, $2, $3::jsonb)",
            [courseId, row.version, JSON.stringify(row.content)],
          );
          const updated = await client.query(
            "update courses set status = 'published', published_version = version, updated_at = now() where id = $1 returning updated_at",
            [courseId],
          );
          row.status = "published";
          row.updated_at = updated.rows[0].updated_at;
        }
        await client.query("commit");
        return courseFromRow(row);
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async enroll(courseId, studentId) {
      const result = await pool.query(
        `insert into enrollments (course_id, student_id) select id, $2 from courses where id = $1 and status = 'published' and visibility = 'cohort' on conflict (course_id, student_id) do update set joined_at = enrollments.joined_at returning course_id`,
        [courseId, studentId],
      );
      if (!result.rowCount) throw new Error("课程不可加入。");
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
        throw new Error("课程版本、活动或加入关系已变化，请刷新后重试。");
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
      if (!result.rowCount) throw new Error("没有管理权限，或学生不在课程中。");
    },
  };
}
