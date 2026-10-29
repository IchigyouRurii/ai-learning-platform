import type { Pool } from "pg";
import {
  courseDraftSchema,
  type Course,
  type CourseDocument,
  type CourseDraft,
  type Enrollment,
  type GenerationKind,
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
  moderation_status: "active" | "withdrawn";
  moderation_reason: string;
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
  moderation_status: "active" | "withdrawn";
  moderation_reason: string;
};
const courseColumns = `c.id, c.owner_id, c.status, c.visibility, c.version, coalesce(r.content, c.draft_content) as content, c.created_at, c.updated_at, c.moderation_status, c.moderation_reason`;
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
    moderationStatus: row.moderation_status,
    withdrawalReason: row.moderation_reason,
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
    moderationStatus: row.moderation_status,
    withdrawalReason: row.moderation_reason,
  };
}
const documentColumns = `id, owner_id, status, visibility, version, published_version, draft_revision, draft_content, created_at, updated_at, moderation_status, moderation_reason`;

export function createNeonRepository(pool: Pool): PlatformRepository {
  return {
    async getWorkspace(actor) {
      const teacher = actor.role === "teacher";
      const courses = await pool.query<CourseRow>(
        teacher
          ? `select ${courseColumns} from ${courseFrom} where c.owner_id = $1 order by c.created_at desc`
          : `select ${courseColumns} from ${courseFrom} where (c.status = 'published' and c.visibility = 'cohort' and c.moderation_status = 'active') or (c.owner_id = $1 and c.visibility = 'personal') order by c.created_at desc`,
        [actor.id],
      );
      const [enrollments, submissions, feedback, members, lessonCompletions] =
        await Promise.all([
          pool.query<Enrollment>(
            `select e.course_id as "courseId", e.student_id as "studentId", e.joined_at as "joinedAt" from enrollments e join courses c on c.id = e.course_id where ${teacher ? "c.owner_id" : "e.student_id"} = $1 and
          e.direct_access`,
            [actor.id],
          ),
          pool.query<Submission>(
            `select s.id, s.course_id as "courseId", s.course_version as "courseVersion", s.activity_id as "activityId", s.student_id as "studentId", s.answer, s.ai_feedback as "aiFeedback", s.score, s.max_score as "maxScore", s.created_at as "createdAt" from submissions s join courses c on c.id = s.course_id where ${teacher ? "c.owner_id" : "s.student_id"} = $1 order by s.created_at`,
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
          pool.query<{
            courseId: string;
            courseVersion: number;
            lessonId: string;
            studentId: string;
            completedAt: Date | string;
          }>(
            `select lc.course_id as "courseId", lc.course_version as "courseVersion", lc.lesson_id as "lessonId", lc.student_id as "studentId", lc.completed_at as "completedAt"
           from lesson_completions lc join courses c on c.id = lc.course_id
           where ${teacher ? "c.owner_id" : "lc.student_id"} = $1
           order by lc.completed_at`,
            [actor.id],
          ),
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
        lessonCompletions: lessonCompletions.rows.map((item) => ({
          ...item,
          completedAt: timestamp(item.completedAt),
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
      const result = await pool.query(
        `select 1 from enrollments e join courses c on c.id = e.course_id
         join "user" u on u.id = e.student_id and u.role = 'student'
         where e.course_id = $1 and e.student_id = $2 and e.direct_access
         and c.status = 'published' and c.moderation_status = 'active'`,
        [courseId, studentId],
      );
      return Boolean(result.rowCount);
    },
    async isCourseManagedByClass(courseId) {
      const result = await pool.query(
        "select 1 from classrooms where course_id = $1 limit 1",
        [courseId],
      );
      return Boolean(result.rowCount);
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
        const owner = await client.query<{ role: string }>(
          'select role from "user" where id = $1 for share',
          [course.ownerId],
        );
        if (
          owner.rows[0]?.role !==
          (course.visibility === "personal" ? "student" : "teacher")
        )
          throw new Error(
            "This account can no longer create this type of course.",
          );
        // The courses_check constraint requires published_version to be set in
        // the same statement as status='published'. The revision FK is
        // deferrable, so the revision can be inserted immediately afterwards.
        const publishedVersion =
          course.status === "published" ? course.version : null;
        await client.query(
          `insert into courses (id, owner_id, status, visibility, version, published_version, draft_content, created_at, updated_at) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
          [
            course.id,
            course.ownerId,
            course.status,
            course.visibility,
            course.version,
            publishedVersion,
            JSON.stringify(content),
            course.createdAt,
            course.updatedAt,
          ],
        );
        if (course.visibility === "personal" && course.status === "published") {
          await client.query(
            "insert into course_revisions (course_id, version, content) values ($1, $2, $3::jsonb)",
            [course.id, course.version, JSON.stringify(content)],
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
        `with available as (select id from courses where id = $1 and status = 'published' and moderation_status = 'active' and (visibility = 'cohort' or (visibility = 'personal' and owner_id = $2)) for share)
         insert into enrollments (course_id, student_id) select id, $2 from available on conflict (course_id, student_id) do update set direct_access = true returning course_id`,
        [courseId, studentId],
      );
      if (!result.rowCount)
        throw new Error("This course is not open for enrollment.");
    },
    async insertSubmission(item) {
      const result = await pool.query(
        `with available as (select id, published_version from courses where id = $2 and status = 'published' and moderation_status = 'active' for share),
        student as (select id from "user" where id = $5 and role = 'student' for share),
        direct_grant as (select e.student_id from enrollments e join available c on c.id = e.course_id where e.student_id = $5 and e.direct_access and c.published_version = $3 for share of e)
        insert into submissions (id, course_id, course_version, activity_id, student_id, answer, ai_feedback, score, max_score, created_at)
        select $1, c.id, r.version, $4, s.id, $6, $7, $8, $9, $10 from available c
        join course_revisions r on r.course_id = c.id and r.version = $3 cross join student s
        where exists(select 1 from direct_grant)
        and exists (select 1 from jsonb_array_elements(r.content->'lessons') l cross join lateral jsonb_array_elements(l->'blocks') b where b->>'type' = 'activity' and b->'activity'->>'id' = $4) returning id`,
        [
          item.id,
          item.courseId,
          item.courseVersion,
          item.activityId,
          item.studentId,
          item.answer,
          item.aiFeedback,
          item.score ?? null,
          item.maxScore ?? null,
          item.createdAt,
        ],
      );
      if (!result.rowCount)
        throw new Error(
          "The course, activity, or enrollment has changed. Refresh and try again.",
        );
      return item;
    },
    async completeLesson(courseId, courseVersion, lessonId, studentId, completed = true) {
      if (!completed) {
        await pool.query(
          `delete from lesson_completions lc
           using courses c, enrollments e
           where lc.course_id = c.id and e.course_id = c.id
             and e.student_id = $4 and e.direct_access
             and c.status = 'published' and c.moderation_status = 'active'
             and lc.course_id = $1 and lc.course_version = $2
             and lc.lesson_id = $3 and lc.student_id = $4`,
          [courseId, courseVersion, lessonId, studentId],
        );
        return;
      }
      const result = await pool.query(
        `insert into lesson_completions (student_id, course_id, course_version, lesson_id)
         select $4, c.id, r.version, $3
         from courses c
         join course_revisions r on r.course_id = c.id and r.version = $2
         join enrollments e on e.course_id = c.id and e.student_id = $4 and e.direct_access
         where c.id = $1 and c.status = 'published' and c.moderation_status = 'active'
           and exists (
             select 1 from jsonb_array_elements(r.content->'lessons') lesson
             where lesson->>'id' = $3
           )
         on conflict (student_id, course_id, course_version, lesson_id) do nothing
         returning lesson_id`,
        [courseId, courseVersion, lessonId, studentId],
      );
      if (!result.rowCount) {
        const existing = await pool.query(
          "select 1 from lesson_completions where student_id = $1 and course_id = $2 and course_version = $3 and lesson_id = $4",
          [studentId, courseId, courseVersion, lessonId],
        );
        if (!existing.rowCount)
          throw new Error(
            "The course, lesson, or enrollment has changed. Refresh and try again.",
          );
      }
    },
    async insertFeedback(item) {
      const result = await pool.query(
        `insert into teacher_feedback (id, course_id, student_id, teacher_id, message, created_at) select $1, c.id, e.student_id, $4, $5, $6 from courses c join enrollments e on e.course_id = c.id and e.student_id = $3 where c.id = $2 and c.owner_id = $4 and e.direct_access returning id`,
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
      const stored = await pool.query<{
        id: string;
        owner_id: string;
        title: string;
        steps: LearningPathRecord["steps"];
        created_at: Date | string;
      }>(
        "select id, owner_id, title, steps, created_at from learning_paths where owner_id = $1 order by created_at desc limit 1",
        [ownerId],
      );
      const row = stored.rows[0];
      if (row)
        return {
          id: row.id,
          ownerId: row.owner_id,
          title: row.title,
          steps: row.steps,
          createdAt: timestamp(row.created_at),
          updatedAt: timestamp(row.created_at),
        };
      // Fall back to the single path stored before history was introduced.
      const legacy = await pool.query<{
        learning_path: LearningPathRecord | null;
      }>("select learning_path from learning_profiles where user_id = $1", [
        ownerId,
      ]);
      const path = legacy.rows[0]?.learning_path;
      return path && Object.keys(path).length ? path : null;
    },
    async listLearningPaths(ownerId) {
      const result = await pool.query<{
        id: string;
        owner_id: string;
        title: string;
        steps: LearningPathRecord["steps"];
        created_at: Date | string;
      }>(
        "select id, owner_id, title, steps, created_at from learning_paths where owner_id = $1 order by created_at desc limit 50",
        [ownerId],
      );
      return result.rows.map((row) => ({
        id: row.id,
        ownerId: row.owner_id,
        title: row.title,
        steps: row.steps,
        createdAt: timestamp(row.created_at),
        updatedAt: timestamp(row.created_at),
      }));
    },
    async saveLearningPath(path) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(
          "insert into learning_paths (id, owner_id, title, steps, created_at) values ($1, $2, $3, $4::jsonb, $5)",
          [
            path.id,
            path.ownerId,
            path.title,
            JSON.stringify(path.steps),
            path.createdAt,
          ],
        );
        await client.query(
          `insert into learning_profiles (user_id, learning_path, updated_at) values ($1, $2::jsonb, now()) on conflict (user_id) do update set learning_path = excluded.learning_path, updated_at = now()`,
          [path.ownerId, JSON.stringify(path)],
        );
        await client.query("commit");
        return path;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async insertGenerationRecord(record) {
      await pool.query(
        "insert into generation_records (id, owner_id, kind, course_id, input, result, created_at) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)",
        [
          record.id,
          record.ownerId,
          record.kind,
          record.courseId,
          JSON.stringify(record.input),
          record.result === null ? null : JSON.stringify(record.result),
          record.createdAt,
        ],
      );
      return record;
    },
    async listGenerationRecords(
      ownerId,
      options: {
        kind?: GenerationKind;
        courseId?: string;
        limit?: number;
      } = {},
    ) {
      const conditions = ["owner_id = $1"];
      const values: unknown[] = [ownerId];
      if (options.kind) {
        values.push(options.kind);
        conditions.push(`kind = $${values.length}`);
      }
      if (options.courseId) {
        values.push(options.courseId);
        conditions.push(`course_id = $${values.length}`);
      }
      values.push(options.limit ?? 20);
      const result = await pool.query<{
        id: string;
        owner_id: string;
        kind: GenerationKind;
        course_id: string | null;
        input: unknown;
        result: unknown;
        created_at: Date | string;
      }>(
        `select id, owner_id, kind, course_id, input, result, created_at from generation_records where ${conditions.join(" and ")} order by created_at desc limit $${values.length}`,
        values,
      );
      return result.rows.map((row) => ({
        id: row.id,
        ownerId: row.owner_id,
        kind: row.kind,
        courseId: row.course_id,
        input: row.input,
        result: row.result,
        createdAt: timestamp(row.created_at),
      }));
    },
  };
}
